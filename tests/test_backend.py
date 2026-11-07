import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
import unittest

from market_guard import Instrument, MarketError, Quote, paper_quote, required_number, resolve_instrument, strict_json
from service_patterns import ReportFacts, ai_report, screener


class GuardTests(unittest.TestCase):
    def test_master_lookup_and_unknown(self):
        mrf = Instrument("sample-mrf", "NSE", "MRF", "INR")
        def lookup(exchange, symbol):
            return {("NSE", "MRF"): mrf}.get((exchange, symbol))
        self.assertEqual(resolve_instrument(" mrf ", "NSE", lookup), mrf)
        with self.assertRaises(MarketError) as result:
            resolve_instrument("ZZZINVALIDTEST", "NSE", lookup)
        self.assertEqual(result.exception.code, "UNKNOWN_SYMBOL")

    def test_strict_output(self):
        self.assertEqual(json.loads(strict_json({"optional": None})), {"optional": None})
        for value in [float("nan"), float("inf"), -float("inf")]:
            with self.subTest(value=value):
                with self.assertRaises(MarketError):
                    strict_json({"atr_14": value})
                with self.assertRaises(MarketError):
                    required_number(value, "ATR")

    def test_reject_stale_or_mismatched_paper_quote(self):
        now = datetime.now(timezone.utc)
        asset = Instrument("asset-1", "NSE", "TEST", "INR")
        quote = Quote("quote-1", "asset-1", "INR", Decimal("100"), now, "fixture", "LIVE")
        self.assertEqual(paper_quote(quote, asset, now, timedelta(seconds=30)), quote)
        with self.assertRaises(MarketError):
            paper_quote(quote, asset, now + timedelta(seconds=31), timedelta(seconds=30))
        with self.assertRaises(MarketError):
            paper_quote(quote, Instrument("other", "NSE", "OTHER", "INR"), now, timedelta(seconds=30))


class ServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_screener_empty_is_not_timeout(self):
        async def empty():
            return []
        async def slow():
            await asyncio.sleep(2)
        self.assertEqual((await screener(empty))["state"], "empty")
        with self.assertRaises(MarketError) as result:
            await screener(slow, timeout=0.01)
        self.assertEqual(result.exception.code, "SCREENER_TIMEOUT")

    async def test_ai_timeout_returns_bounded_fallback(self):
        async def slow(_facts):
            await asyncio.sleep(2)
        facts = ReportFacts("sample", "forecast-1", "2026-11-06", 5, "Neutral")
        report = await ai_report(facts, slow, timeout=0.01)
        self.assertEqual(report["source"], "structured_fallback")
        self.assertEqual(report["forecast_id"], "forecast-1")

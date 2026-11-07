"""Offline regression coverage for the production provider failure paths."""
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

import ai_engine
import screener
import ticker_universe
from app import app
from market_guard import MarketError


class ProviderRecoveryTests(unittest.TestCase):
    def test_mrf_resolves_from_a_cold_database_without_provider_io(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(
            ticker_universe, "DB_PATH", str(Path(tmp) / "tickers.db")
        ), patch.object(ticker_universe.yf, "Ticker", side_effect=OSError):
            valid, symbol, meta = ticker_universe.resolve_and_validate_symbol("MRF")
        self.assertTrue(valid)
        self.assertEqual(symbol, "MRF.NS")
        self.assertEqual(meta["isin"], "INE883A01011")

    def test_slow_ai_returns_factual_fallback_without_waiting_for_worker(self):
        release = threading.Event()
        finished = threading.Event()

        def slow(*_args):
            release.wait(2)
            finished.set()
            return "Late answer"

        with patch.object(ai_engine, "get_stock_data", return_value={
            "ticker": "TCS.NS", "current_price": 100.0,
        }), patch.object(ai_engine, "_agent_master_report", side_effect=slow):
            try:
                report = ai_engine.analyze_stock("TCS", api_key="test", timeout=0.05)
                self.assertFalse(finished.is_set())
            finally:
                release.set()

        self.assertEqual(report["source"], "structured_fallback")
        self.assertNotIn("Late answer", report["master_report"])
        self.assertNotIn("High-probability", report["master_report"])

    def test_report_data_timeout_is_a_structured_api_error(self):
        with patch.object(ai_engine, "analyze_stock", side_effect=MarketError(
            504, "REPORT_DATA_TIMEOUT", "Market data timed out"
        )):
            response = app.test_client().post("/api/analyze", json={"ticker": "TCS"})
        self.assertEqual(response.status_code, 504)
        self.assertEqual(response.get_json()["error_code"], "REPORT_DATA_TIMEOUT")

    def test_blank_client_key_uses_the_configured_server_key(self):
        with patch.dict("os.environ", {"GROQ_API_KEY": "server-fixture"}), patch.object(
            ai_engine, "analyze_stock", return_value={
                "source": "ai", "ticker": "TCS", "language": "English", "master_report": "Commentary",
            }
        ) as provider:
            response = app.test_client().post("/api/analyze", json={"ticker": "TCS", "api_key": ""})
        self.assertEqual(response.get_json()["source"], "ai")
        self.assertEqual(provider.call_args.kwargs["api_key"], "server-fixture")

    def test_daily_screener_inputs_use_provider_bars_and_their_session_date(self):
        bars = pd.DataFrame({
            "Open": [100.0, 110.0], "High": [101.0, 112.0],
            "Low": [99.0, 109.0], "Close": [100.0, 110.0],
        }, index=pd.to_datetime(["2026-11-05", "2026-11-06"]))
        with patch.object(screener.yf, "Ticker") as ticker:
            ticker.return_value.history.return_value = bars
            data = screener._load_scan_data("TCS.NS")
        self.assertEqual(data["current_price"], 110.0)
        self.assertAlmostEqual(data["change_pct"], 10.0)
        self.assertEqual(data["observed_at"], "2026-11-06")
        self.assertIsNone(data["week_52_high"])

    def test_screener_does_not_return_seed_prices_on_provider_failure(self):
        with patch.object(screener, "SCREENER_CACHE", {"time": 0, "as_of": None, "data": None}), patch.object(
            screener, "SCAN_FUTURES", []
        ), patch.object(screener, "_load_scan_data", side_effect=OSError):
            with self.assertRaises(MarketError) as result:
                screener.scan_stocks(timeout=1)
        self.assertEqual(result.exception.code, "SCREENER_UNAVAILABLE")

    def test_screener_retry_reuses_pending_scan_and_missing_metrics_stay_null(self):
        release = threading.Event()
        started = threading.Event()
        def slow(*_args, **_kwargs):
            started.set()
            release.wait(2)
            return {"current_price": 100.0}

        with patch.object(screener, "SCREENER_CACHE", {"time": 0, "as_of": None, "data": None}), patch.object(
            screener, "SCAN_FUTURES", []
        ), patch.object(screener, "SCREENER_CANDIDATES", ["TCS.NS"]), patch.object(
            screener, "_load_scan_data", side_effect=slow
        ) as provider:
            try:
                with self.assertRaises(MarketError) as result:
                    screener.scan_stocks(timeout=0.05)
                self.assertEqual(result.exception.code, "SCREENER_TIMEOUT")
                self.assertTrue(started.is_set())
            finally:
                release.set()
            rows = screener.scan_stocks(timeout=1)["data"]
            self.assertEqual(provider.call_count, 1)
        self.assertIsNone(rows[0]["vol_ratio"])
        self.assertEqual(rows[0]["tags"], [])

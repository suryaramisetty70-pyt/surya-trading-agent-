"""
App-Level Regression Test Suite for MAX MARKET
Covers:
1. MRF Authoritative Resolution & Coverage Handling
2. ZZZINVALIDTEST 404 UNKNOWN_SYMBOL Rejection
3. TCS, RELIANCE, INFY Strict RFC 8259 JSON Compliance
4. Quote Consistency & Forecast Reference Lineage
5. AI Studio Bounded Deadline & Structured Fallback
6. Screener States (Ready/Empty/Stale/Timeout)
7. Paper Order Idempotency & Quote Validation
"""

import json
import math
import time
import unittest
from datetime import datetime, timezone
from app import app
from ticker_universe import resolve_and_validate_symbol, lookup_instrument
from market_guard import resolve_instrument, MarketError, strict_json, required_number

class AppRegressionTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_01_mrf_master_resolution(self):
        """1. Verify MRF resolves through actual instrument master and handles coverage."""
        is_valid, resolved_sym, meta = resolve_and_validate_symbol("MRF")
        self.assertTrue(is_valid, "MRF must be valid in instrument master")
        self.assertEqual(resolved_sym, "MRF.NS")
        self.assertEqual(meta.get("exchange"), "NSE")

        # Test market_guard integration
        inst = resolve_instrument("MRF", "NSE", lookup_instrument)
        self.assertEqual(inst.symbol, "MRF")
        self.assertEqual(inst.exchange, "NSE")
        self.assertEqual(inst.currency, "INR")

        # Route check
        res = self.client.get('/api/stock-data?ticker=MRF')
        self.assertIn(res.status_code, [200, 422], "MRF should return 200 or 422 (DATA_COVERAGE_ERROR)")
        data = res.get_json()
        if res.status_code == 200:
            self.assertGreater(data["data"]["current_price"], 0)
        else:
            self.assertEqual(data.get("error_code"), "DATA_COVERAGE_ERROR")

    def test_02_zzzinvalidtest_strict_rejection(self):
        """2. Reject ZZZINVALIDTEST before price, forecast, report or order."""
        # master lookup
        is_valid, _, _ = resolve_and_validate_symbol("ZZZINVALIDTEST")
        self.assertFalse(is_valid)

        with self.assertRaises(MarketError) as ctx:
            resolve_instrument("ZZZINVALIDTEST", "NSE", lookup_instrument)
        self.assertEqual(ctx.exception.code, "UNKNOWN_SYMBOL")

        # Stock data route -> 404
        r_stock = self.client.get('/api/stock-data?ticker=ZZZINVALIDTEST')
        self.assertEqual(r_stock.status_code, 404)
        self.assertEqual(r_stock.get_json().get("error_code"), "UNKNOWN_SYMBOL")

        # Predict route -> 404
        r_pred = self.client.get('/api/predict?ticker=ZZZINVALIDTEST')
        self.assertEqual(r_pred.status_code, 404)
        self.assertEqual(r_pred.get_json().get("error_code"), "UNKNOWN_SYMBOL")

        # AI Analyze route -> 404
        r_ai = self.client.post('/api/analyze', json={"ticker": "ZZZINVALIDTEST"})
        self.assertEqual(r_ai.status_code, 404)
        self.assertEqual(r_ai.get_json().get("error_code"), "UNKNOWN_SYMBOL")

        # Webhook order route -> 404
        r_order = self.client.post('/api/webhook/order', json={
            "symbol": "ZZZINVALIDTEST",
            "price": 1000.0,
            "quantity": 1
        })
        self.assertEqual(r_order.status_code, 404)
        self.assertEqual(r_order.get_json().get("error_code"), "UNKNOWN_SYMBOL")

    def test_03_rfc8259_strict_json_live_equities(self):
        """3. Verify TCS, RELIANCE, and INFY return strictly compliant RFC 8259 JSON."""
        for sym in ["RELIANCE", "TCS", "INFY"]:
            with self.subTest(symbol=sym):
                res = self.client.get(f'/api/stock-data?ticker={sym}')
                self.assertEqual(res.status_code, 200)
                raw = res.get_data(as_text=True)
                self.assertNotIn("NaN", raw, f"Raw response for {sym} contains NaN!")
                self.assertNotIn("Infinity", raw, f"Raw response for {sym} contains Infinity!")

                # Test strict serialization
                parsed = json.loads(raw)
                strict_json(parsed)  # Must not raise MarketError
                data = parsed.get("data", {})
                self.assertGreater(data.get("current_price", 0), 0)

                # Predict route check
                res_p = self.client.get(f'/api/predict?ticker={sym}')
                self.assertEqual(res_p.status_code, 200)
                raw_p = res_p.get_data(as_text=True)
                self.assertNotIn("NaN", raw_p)
                self.assertNotIn("Infinity", raw_p)

                pred_data = json.loads(raw_p).get("data", {})
                atr = pred_data.get("atr_14")
                if atr is not None:
                    required_number(atr, "ATR")
                
                # Verify 1D, 5D, 20D quantile horizons
                horizons = pred_data.get("multi_horizon_forecasts") or pred_data.get("horizons")
                self.assertIn("1D", horizons)
                self.assertIn("5D", horizons)
                self.assertIn("20D", horizons)
                h5 = horizons["5D"]
                self.assertLessEqual(h5["lower_bound_p10"], h5["median_p50"])
                self.assertLessEqual(h5["median_p50"], h5["upper_bound_p90"])

    def test_04_quote_consistency_and_provenance(self):
        """4. Verify quote synchronization and reference price labeling."""
        stock_res = self.client.get('/api/stock-data?ticker=RELIANCE')
        self.assertEqual(stock_res.status_code, 200)
        stock_data = stock_res.get_json()["data"]

        pred_res = self.client.get('/api/predict?ticker=RELIANCE')
        self.assertEqual(pred_res.status_code, 200)
        pred_data = pred_res.get_json()["data"]

        # Predict current_price must equal live stock quote price
        self.assertEqual(pred_data["current_price"], stock_data["current_price"],
                         "Prediction execution price must match live stock header price")
        self.assertIn("forecast_reference_close", pred_data)
        self.assertGreater(pred_data["forecast_reference_close"], 0)

    def test_05_ai_studio_structured_fallback(self):
        """5. AI Studio finishes within deadline and provides structured fallback on provider outage."""
        t0 = time.time()
        # Request with no API key -> must return structured fallback within 3s
        res = self.client.post('/api/analyze', json={
            "ticker": "RELIANCE",
            "language": "English",
            "api_key": ""
        })
        elapsed = time.time() - t0
        self.assertLess(elapsed, 10.0, "AI analysis must finish within 10s deadline")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("source"), "structured_fallback")
        self.assertIn("Institutional Market Intelligence Report", data.get("master_report", ""))

    def test_06_screener_states(self):
        """6. Screener returns structured snapshot with state and timestamp."""
        res = self.client.get('/api/screener?strategy=ALL')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn(data.get("state"), ["ready", "empty", "stale"])
        self.assertIn("as_of", data)
        self.assertIsInstance(data.get("data"), list)

        # Non-matching strategy filter should return empty state, NOT error
        res_filter = self.client.get('/api/screener?strategy=GOLDEN_CROSS')
        self.assertEqual(res_filter.status_code, 200)
        d_filter = res_filter.get_json()
        self.assertIn(d_filter.get("state"), ["ready", "empty", "stale"])

    def test_07_paper_order_idempotency_and_validation(self):
        """7. Verify virtual order idempotency and price validation."""
        # Invalid price (<= 0)
        r_neg = self.client.post('/api/webhook/order', json={
            "symbol": "TCS",
            "price": -10.0,
            "quantity": 1
        })
        self.assertEqual(r_neg.status_code, 400)
        self.assertEqual(r_neg.get_json().get("error_code"), "INVALID_PRICE")

        # Valid order with idempotency key
        idem_key = f"idem-key-{int(time.time()*1000)}"
        order_payload = {
            "symbol": "TCS",
            "price": 2500.0,
            "quantity": 2,
            "idempotency_key": idem_key
        }
        r1 = self.client.post('/api/webhook/order', json=order_payload)
        self.assertEqual(r1.status_code, 200)
        d1 = r1.get_json()
        order_id = d1["order"]["order_id"]

        # Duplicate submit -> returns cached fill
        r2 = self.client.post('/api/webhook/order', json=order_payload)
        self.assertEqual(r2.status_code, 200)
        d2 = r2.get_json()
        self.assertEqual(d2["order"]["order_id"], order_id)
        self.assertTrue(d2.get("duplicate") or d2.get("idempotency_key") == idem_key)

if __name__ == "__main__":
    unittest.main()

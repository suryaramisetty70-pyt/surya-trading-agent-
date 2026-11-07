import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

import ai_engine
import ticker_universe as universe


class MarketCoverageTests(unittest.TestCase):
    def test_cold_lookup_imports_an_exact_nse_master_record(self):
        frame = pd.DataFrame([{
            "SYMBOL": "EXAMPLECO", "NAME OF COMPANY": "Example Company", "ISIN NUMBER": "TEST",
        }])
        with tempfile.TemporaryDirectory() as directory, patch.object(
            universe, "DB_PATH", str(Path(directory) / "tickers.db")
        ), patch.object(universe, "MASTER_REFRESH_AFTER", 0), patch.object(
            universe, "fetch_nse_master_csv", return_value=frame
        ) as fetch, patch.object(universe.yf, "Ticker", side_effect=OSError):
            self.assertEqual(universe.resolve_and_validate_symbol("exampleco")[1], "EXAMPLECO.NS")
            self.assertFalse(universe.resolve_and_validate_symbol("example")[0])
            self.assertFalse(universe.resolve_and_validate_symbol("EXAMPLECO.BO")[0])
            fetch.assert_called_once()

    def test_unavailable_or_malformed_master_is_not_reported_as_synced(self):
        for frame in [None, pd.DataFrame([{"invalid": "response"}])]:
            with patch.object(universe, "fetch_nse_master_csv", return_value=frame):
                with self.assertRaises(ValueError):
                    universe.sync_universe()

    def test_full_report_keeps_facts_when_ai_is_unavailable(self):
        with patch.object(ai_engine, "get_stock_data", return_value={
            "ticker": "MRF.NS", "current_price": 100.0, "source": "Provider test fixture",
            "status": "HISTORICAL_CLOSE", "rsi_14": float("nan"), "target_price": 0,
            "quarterly_revenue": [{"quarter": "2026-06", "revenue_cr": 12.0}],
        }):
            report = ai_engine.analyze_stock("MRF")["master_report"]
        self.assertIn("Provider test fixture", report)
        self.assertIn("historical close", report)
        self.assertIn("RSI (14 sessions)**: Unavailable", report)
        self.assertIn("2026-06", report)
        self.assertIn("Analyst consensus unavailable", report)

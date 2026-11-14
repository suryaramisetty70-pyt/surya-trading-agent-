"""Offline regression coverage for provider quotes and simulated options."""
from unittest.mock import patch

from app import app
import options_engine
import stock_data


def test_top_stocks_reuses_provider_stock_snapshot():
    quote = {
        "current_price": 2407.50, "change": -34.90, "change_pct": -1.43,
        "source": "Yahoo Finance quote", "observed_at": None, "quote_id": "test-quote",
    }
    with patch.object(stock_data, "get_stock_data", return_value=quote) as provider:
        client = app.test_client()
        stock = client.get("/api/stock-data?ticker=TCS").get_json()["data"]
        top = client.get("/api/top-stocks").get_json()["stocks"]
    tcs = next(item for item in top if item["ticker"] == "TCS")
    assert tcs["price"] == stock["current_price"]
    assert tcs["quote_id"] == stock["quote_id"]
    assert tcs["observed_at"] is None
    provider.assert_any_call("TCS")


def test_option_chain_is_explicitly_simulated_and_centered_on_selected_spot():
    quotes = {
        "NIFTY": {"current_price": 24950},
        "BANKNIFTY": {"current_price": 61034.10, "source": "Yahoo Finance quote"},
    }
    with patch.dict(options_engine.OPTIONS_CACHE, clear=True), patch.object(
        options_engine, "get_stock_data", side_effect=quotes.__getitem__
    ):
        client = app.test_client()
        nifty = client.get("/api/options-chain?ticker=NIFTY").get_json()["data"]
        bank = client.get("/api/options-chain?ticker=BANKNIFTY").get_json()["data"]
    assert nifty["symbol"] == "NIFTY"
    assert bank["mode"] == "simulated"
    assert bank["symbol"] == "BANKNIFTY"
    assert bank["spot_price"] == 61034.10
    assert [row["strike"] for row in bank["chain"] if row["is_atm"]] == [61000]


def test_options_rejects_missing_spot_without_synthetic_fallback():
    with patch.dict(options_engine.OPTIONS_CACHE, clear=True), patch.object(
        options_engine, "get_stock_data", return_value={"current_price": 0}
    ):
        response = app.test_client().get("/api/options-chain?ticker=BANKNIFTY")
    assert response.status_code == 422
    assert response.get_json()["error_code"] == "DATA_COVERAGE_ERROR"


def test_missing_ticker_is_not_looked_up_repeatedly_across_routes():
    import pandas as pd
    import ticker_universe

    with patch.dict(ticker_universe.PROVIDER_MISSES, clear=True), patch.object(
        ticker_universe, "_lookup_local", return_value=None
    ), patch.object(ticker_universe, "_refresh_master_if_due"), patch.object(
        ticker_universe.yf, "Ticker"
    ) as provider:
        provider.return_value.history.return_value = pd.DataFrame()
        client = app.test_client()
        for url in ("/api/stock-data", "/api/predict"):
            assert client.get(url, query_string={"ticker": "ZZZTEST"}).status_code == 404
        assert client.post("/api/analyze", json={"ticker": "ZZZTEST"}).status_code == 404
        provider.assert_called_once_with("ZZZTEST")

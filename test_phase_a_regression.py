"""
Phase A Comprehensive Regression Test Suite for MAX MARKET
Verifies:
1. Strict RFC 8259 JSON compliance (zero bare NaNs or Infs across all endpoints).
2. Proper 404 UNKNOWN_SYMBOL rejection for non-existent tickers (e.g., ZZZINVALIDTEST).
3. 1D, 5D, 20D quantile horizon predictions (P10, P50, P90).
4. Idempotent virtual order processing.
5. Fast negative symbol resolution caching.
"""

import json
import math
import sys
import time

def run_tests():
    from app import app
    client = app.test_client()
    passed = 0
    total = 0

    print("=== RUNNING MAX MARKET PHASE A REGRESSION TESTS ===\n")

    # TEST 1: ZZZINVALIDTEST on /api/stock-data -> 404 UNKNOWN_SYMBOL
    total += 1
    t0 = time.time()
    res = client.get('/api/stock-data?ticker=ZZZINVALIDTEST')
    elapsed = time.time() - t0
    assert res.status_code == 404, f"Expected 404, got {res.status_code}"
    data = res.get_json()
    assert data.get("error_code") == "UNKNOWN_SYMBOL", f"Expected UNKNOWN_SYMBOL, got {data}"
    # Verify strict RFC 8259 - json.loads must pass without allow_nan
    raw_text = res.get_data(as_text=True)
    json.loads(raw_text, parse_constant=lambda c: (_ for _ in ()).throw(ValueError(f"Invalid JSON constant: {c}")))
    print(f"PASS [1/6]: /api/stock-data?ticker=ZZZINVALIDTEST -> 404 UNKNOWN_SYMBOL ({elapsed:.3f}s)")
    passed += 1

    # TEST 2: Fast Negative Cache on ZZZINVALIDTEST
    total += 1
    t0 = time.time()
    res = client.get('/api/stock-data?ticker=ZZZINVALIDTEST')
    elapsed = time.time() - t0
    assert res.status_code == 404
    assert elapsed < 0.1, f"Expected fast negative cache (<0.1s), took {elapsed:.3f}s"
    print(f"PASS [2/6]: Negative cache hit on ZZZINVALIDTEST took {elapsed*1000:.1f}ms")
    passed += 1

    # TEST 3: ZZZINVALIDTEST on /api/predict -> 404 UNKNOWN_SYMBOL
    total += 1
    res = client.get('/api/predict?ticker=ZZZINVALIDTEST')
    assert res.status_code == 404, f"Expected 404, got {res.status_code}"
    data = res.get_json()
    assert data.get("error_code") == "UNKNOWN_SYMBOL"
    print("PASS [3/6]: /api/predict?ticker=ZZZINVALIDTEST -> 404 UNKNOWN_SYMBOL")
    passed += 1

    # TEST 4: ZZZINVALIDTEST on /api/webhook/order -> 404 UNKNOWN_SYMBOL
    total += 1
    res = client.post('/api/webhook/order', json={
        "ticker": "ZZZINVALIDTEST",
        "action": "BUY",
        "quantity": 1,
        "price": 1000.0,
        "strategy": "TEST"
    })
    assert res.status_code == 404, f"Expected 404, got {res.status_code}"
    data = res.get_json()
    assert data.get("error_code") == "UNKNOWN_SYMBOL"
    print("PASS [4/6]: /api/webhook/order with invalid symbol -> 404 UNKNOWN_SYMBOL")
    passed += 1

    # TEST 5: RELIANCE /api/stock-data & /api/predict Strict RFC 8259 Compliance
    total += 1
    for symbol in ["RELIANCE", "TCS"]:
        res_stock = client.get(f'/api/stock-data?ticker={symbol}')
        assert res_stock.status_code == 200, f"Expected 200 for {symbol}, got {res_stock.status_code}"
        raw_stock = res_stock.get_data(as_text=True)
        # Check no bare NaN or Infinity
        assert "NaN" not in raw_stock, f"Raw stock response for {symbol} contained bare NaN!"
        assert "Infinity" not in raw_stock, f"Raw stock response for {symbol} contained bare Infinity!"
        stock_json = json.loads(raw_stock)
        stock_data = stock_json.get("data", stock_json)
        assert stock_data["current_price"] > 0, f"Invalid price {stock_data.get('current_price')}"

        res_pred = client.get(f'/api/predict?ticker={symbol}')
        assert res_pred.status_code == 200, f"Expected 200 for {symbol} predict, got {res_pred.status_code}"
        raw_pred = res_pred.get_data(as_text=True)
        assert "NaN" not in raw_pred, f"Prediction response for {symbol} contained bare NaN!"
        assert "Infinity" not in raw_pred, f"Prediction response for {symbol} contained bare Infinity!"
        pred_json = json.loads(raw_pred)
        pred_data = pred_json.get("data", pred_json)

        # Check multi-horizon keys: 1D, 5D, 20D
        horizons = pred_data.get("horizons", {})
        assert "1D" in horizons, "Missing 1D horizon"
        assert "5D" in horizons, "Missing 5D horizon"
        assert "20D" in horizons, "Missing 20D horizon"

        # Check quantile fields in 5D
        h5 = horizons["5D"]
        assert "median_p50" in h5, "Missing median_p50"
        assert "lower_bound_p10" in h5, "Missing lower_bound_p10"
        assert "upper_bound_p90" in h5, "Missing upper_bound_p90"
        assert h5["lower_bound_p10"] <= h5["median_p50"] <= h5["upper_bound_p90"], "Quantiles inverted!"

        # Check ATR is finite float
        atr = pred_data.get("atr_14")
        assert atr is None or (isinstance(atr, (int, float)) and math.isfinite(atr)), f"Invalid atr_14: {atr}"

    print("PASS [5/6]: RELIANCE and TCS strict RFC 8259 JSON & 1D/5D/20D quantiles validated")
    passed += 1

    # TEST 6: Virtual Order Idempotency
    total += 1
    idem_key = f"test-key-{int(time.time()*1000)}"
    order_payload = {
        "ticker": "TCS",
        "action": "BUY",
        "quantity": 1,
        "price": 2500.0,
        "strategy": "UNIT_TEST",
        "idempotency_key": idem_key
    }
    res1 = client.post('/api/webhook/order', json=order_payload)
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}"
    d1 = res1.get_json()
    assert d1.get("status") == "success"

    res2 = client.post('/api/webhook/order', json=order_payload)
    assert res2.status_code == 200, f"Expected 200, got {res2.status_code}"
    d2 = res2.get_json()
    assert d2.get("idempotency_key") == idem_key
    assert d2.get("status") == "success"
    print("PASS [6/6]: Order execution idempotency verified")
    passed += 1

    print(f"\n==========================================")
    print(f"ALL {passed}/{total} PHASE A REGRESSION TESTS PASSED!")
    print(f"==========================================")

if __name__ == "__main__":
    run_tests()

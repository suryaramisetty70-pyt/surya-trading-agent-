import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:5000"
DEV_URL = "http://127.0.0.1:8080"

results = []

def test_endpoint(name, url, method="GET", payload=None):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, method=method)
        if payload is not None:
            data_bytes = json.dumps(payload).encode('utf-8')
            req.add_header('Content-Type', 'application/json')
            req.data = data_bytes
        
        with urllib.request.urlopen(req, timeout=12) as response:
            status_code = response.getcode()
            elapsed = round((time.time() - t0) * 1000, 1)
            raw = response.read().decode('utf-8')
            
            summary = "OK"
            try:
                js = json.loads(raw)
                if isinstance(js, dict):
                    if "status" in js:
                        summary = f"status={js.get('status')}"
                    if "data" in js:
                        d = js["data"]
                        if isinstance(d, list):
                            summary += f", count={len(d)}"
                        elif isinstance(d, dict):
                            keys = list(d.keys())[:3]
                            summary += f", keys={keys}"
                    elif "stocks" in js:
                        summary += f", count={len(js['stocks'])}"
                    elif "indices" in js:
                        summary += f", count={len(js['indices'])}"
            except Exception:
                summary = f"HTML/Text ({len(raw)} chars)"
                
            results.append({
                "step": name,
                "url": url,
                "status": "PASS",
                "code": status_code,
                "latency_ms": elapsed,
                "details": summary
            })
            print(f"PASS: [{name}] - {status_code} ({elapsed}ms) -> {summary}")
    except Exception as e:
        elapsed = round((time.time() - t0) * 1000, 1)
        results.append({
            "step": name,
            "url": url,
            "status": "FAIL",
            "code": getattr(e, 'code', 'ERR'),
            "latency_ms": elapsed,
            "details": str(e)
        })
        print(f"FAIL: [{name}] - ({elapsed}ms) -> {e}")

print("=================================================================")
print("  EXECUTING HUMAN-LIKE STEP-BY-STEP FULL PLATFORM VERIFICATION   ")
print("=================================================================\n")

# 1. Web Interfaces
test_endpoint("1. Web Server Root (UI)", f"{BASE_URL}/")
test_endpoint("2. Vite Dev Server (HMR)", f"{DEV_URL}/")

# 2. Market Pulse
test_endpoint("3. All India Indices", f"{BASE_URL}/api/all-india-indices")
test_endpoint("4. Top Market Movers", f"{BASE_URL}/api/top-stocks")

# 3. Stock Analytics
test_endpoint("5. Real Stock Data (RELIANCE)", f"{BASE_URL}/api/stock-data?ticker=RELIANCE")
test_endpoint("6. Real Stock Data (TCS)", f"{BASE_URL}/api/stock-data?ticker=TCS")

# 4. ML Prediction Engine
test_endpoint("7. ML 5-Day Prediction (RELIANCE)", f"{BASE_URL}/api/predict?ticker=RELIANCE")
test_endpoint("8. ML 5-Day Prediction (TCS)", f"{BASE_URL}/api/predict?ticker=TCS")

# 5. Options & Greeks Engine
test_endpoint("9. Options Chain (NIFTY)", f"{BASE_URL}/api/options-chain?ticker=NIFTY")
test_endpoint("10. Options Chain (BANKNIFTY)", f"{BASE_URL}/api/options-chain?ticker=BANKNIFTY")

# 6. Institutional Breakout Screener
test_endpoint("11. Screener (ALL)", f"{BASE_URL}/api/screener?strategy=ALL")
test_endpoint("12. Screener (52W HIGH)", f"{BASE_URL}/api/screener?strategy=52W_HIGH")
test_endpoint("13. Screener (GOLDEN CROSS)", f"{BASE_URL}/api/screener?strategy=GOLDEN_CROSS")
test_endpoint("14. Screener (VOLUME SURGE)", f"{BASE_URL}/api/screener?strategy=VOLUME_SURGE")

# 7. Broker & Webhook Execution
test_endpoint("15. Broker Status (Initial)", f"{BASE_URL}/api/broker/status")
test_endpoint("16. Webhook Order Execution", f"{BASE_URL}/api/webhook/order", method="POST", payload={
    "symbol": "INFY",
    "action": "BUY",
    "quantity": 25,
    "price": 1450.0,
    "source": "Automated Quality Assurance Bot"
})
test_endpoint("17. Broker Status (Post-Execution)", f"{BASE_URL}/api/broker/status")

# 8. Universe & Model Registry
test_endpoint("18. Ticker Universe Stats", f"{BASE_URL}/api/universe/stats")
test_endpoint("19. ML Model Registry History", f"{BASE_URL}/api/models/history")
test_endpoint("20. Groq AI Status", f"{BASE_URL}/api/ai-status")

print("\n=================================================================")
passed = len([r for r in results if r["status"] == "PASS"])
failed = len([r for r in results if r["status"] == "FAIL"])
print(f"VERIFICATION SUMMARY: {passed} PASSED, {failed} FAILED / {len(results)} TOTAL")
print("=================================================================")

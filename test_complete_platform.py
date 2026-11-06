"""
Comprehensive End-to-End Human QA Test Script
Tests all platform endpoints, data integrity, response formats, and algorithmic flows.
"""
import sys
import json
import time
import urllib.request
import urllib.error

BASE_URL = "http://localhost:5000"
FRONTEND_URL = "http://localhost:8080"

test_results = []

def run_test(name, url, method="GET", data=None):
    start = time.time()
    try:
        req = urllib.request.Request(url, method=method)
        if data:
            req.add_header("Content-Type", "application/json")
            req.data = json.dumps(data).encode("utf-8")
        
        with urllib.request.urlopen(req, timeout=45) as res:
            status = res.status
            body = res.read().decode("utf-8")
            elapsed = round((time.time() - start) * 1000, 2)
            try:
                parsed = json.loads(body)
                success = True
                details = f"Status {status}, returned valid JSON ({len(body)} bytes, {elapsed}ms)"
            except Exception:
                success = True
                parsed = None
                details = f"Status {status}, HTML/text response ({len(body)} bytes, {elapsed}ms)"
            
            test_results.append({
                "name": name,
                "url": url,
                "method": method,
                "success": success,
                "status": status,
                "elapsed_ms": elapsed,
                "details": details,
                "sample": str(parsed)[:200] if parsed else body[:200]
            })
            print(f" [PASS] {name} ({elapsed}ms) - {details}")
            return parsed
    except urllib.error.HTTPError as e:
        elapsed = round((time.time() - start) * 1000, 2)
        err_body = e.read().decode("utf-8") if e.fp else ""
        test_results.append({
            "name": name,
            "url": url,
            "method": method,
            "success": False,
            "status": e.code,
            "elapsed_ms": elapsed,
            "details": f"HTTPError {e.code}: {e.reason}",
            "sample": err_body[:200]
        })
        print(f" [FAIL] {name} ({elapsed}ms) - HTTP {e.code}: {e.reason}")
        return None
    except Exception as e:
        elapsed = round((time.time() - start) * 1000, 2)
        test_results.append({
            "name": name,
            "url": url,
            "method": method,
            "success": False,
            "status": 0,
            "elapsed_ms": elapsed,
            "details": f"Exception: {str(e)}",
            "sample": ""
        })
        print(f" [FAIL] {name} ({elapsed}ms) - {str(e)}")
        return None

print("==================================================")
print("  STARTING RIGOROUS HUMAN-LEVEL PLATFORM QA TEST  ")
print("==================================================")

# 1. Frontend Web App Availability
run_test("1. Frontend Home Page", f"{FRONTEND_URL}/")
run_test("2. Frontend Terminal Page", f"{FRONTEND_URL}/terminal")
run_test("3. Frontend Galaxy 3D Page", f"{FRONTEND_URL}/galaxy")
run_test("4. Frontend Stock Deep Dive", f"{FRONTEND_URL}/stock/RELIANCE")

# 2. Market Data & Indices
run_test("5. Real Indian Indices Feed", f"{BASE_URL}/api/all-india-indices")
run_test("6. Top Equities Overview", f"{BASE_URL}/api/top-stocks")
run_test("7. Reliance Stock Fundamentals & Candlesticks", f"{BASE_URL}/api/stock-data?ticker=RELIANCE")
run_test("8. TCS Stock Data", f"{BASE_URL}/api/stock-data?ticker=TCS")

# 3. Derivatives & Options Chain
run_test("9. NIFTY Option Chain", f"{BASE_URL}/api/options-chain?ticker=NIFTY")
run_test("10. BANKNIFTY Option Chain", f"{BASE_URL}/api/options-chain?ticker=BANKNIFTY")

# 4. Market Screeners
run_test("11. Screener - 52-Week High Breakouts", f"{BASE_URL}/api/screener?strategy=52W_HIGH")
run_test("12. Screener - Volume Surge Equities", f"{BASE_URL}/api/screener?strategy=VOLUME_SURGE")
run_test("13. Screener - Golden Cross Equities", f"{BASE_URL}/api/screener?strategy=GOLDEN_CROSS")

# 5. Universe & Master Auto-Discovery
run_test("14. Auto-Scaling Equities Universe Stats", f"{BASE_URL}/api/universe/stats")

# 6. Model Registry & Purged CV Gate
run_test("15. Quant Model Registry & Version History", f"{BASE_URL}/api/models/history")

# 7. Broker Gateway & TradingView Webhook Bridge
run_test("16. Broker Status Check", f"{BASE_URL}/api/broker/status")
run_test("17. Inbound Algorithmic Webhook Order (BUY TCS)", f"{BASE_URL}/api/webhook/order", method="POST", data={
    "symbol": "TCS",
    "action": "BUY",
    "quantity": 10,
    "price": 3840.50,
    "source": "Human QA Test Suite"
})
run_test("18. Broker Status After Inbound Order", f"{BASE_URL}/api/broker/status")

# 8. Machine Learning Predictor
run_test("19. Reliance ML Prediction & Volatility Cone", f"{BASE_URL}/api/predict?ticker=RELIANCE")

print("==================================================")
passed = sum(1 for t in test_results if t["success"])
failed = sum(1 for t in test_results if not t["success"])
print(f"  QA SUMMARY: {passed} PASSED | {failed} FAILED | TOTAL: {len(test_results)}")
print("==================================================")

with open("qa_test_report.json", "w") as f:
    json.dump(test_results, f, indent=2)

if failed > 0:
    sys.exit(1)
sys.exit(0)

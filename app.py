"""
Flask Web App — Indian Stock Intelligence Platform
Uses ONLY Groq API directly. NO CrewAI. NO Google. NO LiteLLM.
"""

import os
import sys

# ── Set Groq key first, before ANY other imports ──────────────────────────────
# Load from .env file — never hardcode keys in source code!
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
os.environ["GROQ_API_KEY"] = GROQ_API_KEY

# ── Block every possible Google/Gemini env var ────────────────────────────────
for _key in ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS",
             "GOOGLE_CLOUD_PROJECT", "GOOGLE_GENAI_USE_VERTEXAI"]:
    os.environ.pop(_key, None)

# ── Standard imports ──────────────────────────────────────────────────────────
import math
import json
import numpy as np
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory, Response
from dotenv import load_dotenv
load_dotenv(override=False)   # .env won't override what we already set above

# ── App setup ─────────────────────────────────────────────────────────────────
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')

if os.path.exists(FRONTEND_DIST):
    app = Flask(__name__, static_folder=os.path.join(FRONTEND_DIST, 'assets'))
else:
    app = Flask(__name__, template_folder='templates', static_folder='static')

app.json.allow_nan = False

def sanitize_for_json(obj):
    """
    Recursively sanitizes Python objects before JSON serialization to ensure
    strict RFC 8259 compliance:
    - np.nan, float('nan'), math.isnan -> None (serializes to JSON null)
    - np.inf, -np.inf, math.isinf -> None (serializes to JSON null)
    - np.generic types (np.float64, np.int64, np.bool_) -> native Python types
    - datetime / date / timestamp -> ISO formatted strings
    """
    if obj is None:
        return None
    if isinstance(obj, (float, np.floating)):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return float(obj)
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    if isinstance(obj, (str, bytes)):
        return obj if isinstance(obj, str) else obj.decode('utf-8', errors='replace')
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [sanitize_for_json(item) for item in obj]
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    return obj

def safe_jsonify(data, status=200):
    clean = sanitize_for_json(data)
    body = json.dumps(clean, allow_nan=False)
    resp = Response(body, status=status, mimetype='application/json')
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    resp.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return resp

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response


@app.route('/')
@app.route('/terminal')
@app.route('/galaxy')
@app.route('/stock/<path:sub>')
def serve_frontend_routes(sub=''):
    if os.path.exists(FRONTEND_DIST):
        return send_from_directory(FRONTEND_DIST, 'index.html')
    return render_template('index.html')


@app.route('/assets/<path:path>')
def serve_assets(path):
    if os.path.exists(FRONTEND_DIST):
        return send_from_directory(os.path.join(FRONTEND_DIST, 'assets'), path)
    return jsonify({'error': 'Asset not found'}), 404


@app.route('/favicon.ico')
def serve_favicon():
    if os.path.exists(FRONTEND_DIST):
        return send_from_directory(FRONTEND_DIST, 'favicon.ico')
    return ('', 204)


@app.route('/robots.txt')
def serve_robots():
    if os.path.exists(FRONTEND_DIST):
        return send_from_directory(FRONTEND_DIST, 'robots.txt')
    return ('', 204)


@app.route('/api/stock-data', methods=['GET'])
def get_stock_data_route():
    ticker = request.args.get('ticker', 'RELIANCE').strip().upper()
    try:
        from stock_data import get_stock_data
        data = get_stock_data(ticker)
        return safe_jsonify({'status': 'success', 'data': data})
    except ValueError as ve:
        err_msg = str(ve)
        if "UNKNOWN_SYMBOL" in err_msg:
            return safe_jsonify({'status': 'error', 'error_code': 'UNKNOWN_SYMBOL', 'message': err_msg}, status=404)
        if "DATA_COVERAGE_ERROR" in err_msg or "INSUFFICIENT" in err_msg:
            return safe_jsonify({'status': 'error', 'error_code': 'DATA_COVERAGE_ERROR', 'message': err_msg}, status=422)
        return safe_jsonify({'status': 'error', 'error_code': 'INVALID_REQUEST', 'message': err_msg}, status=400)
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/top-stocks', methods=['GET'])
def get_top_stocks_route():
    try:
        from stock_data import get_top_5_stocks
        top_stocks = get_top_5_stocks()
        return safe_jsonify({'status': 'success', 'stocks': top_stocks})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/analyze', methods=['POST'])
def analyze_stock():
    payload = request.json or {}
    ticker = payload.get('ticker', 'RELIANCE').strip().upper()
    language = payload.get('language', 'English').strip()
    model = payload.get('model', 'openai/gpt-oss-120b').strip()
    if 'api_key' in payload:
        api_key = str(payload.get('api_key') or '').strip()
    else:
        custom_header = request.headers.get('X-AI-Key', '').strip() or request.headers.get('X-Groq-Key', '').strip()
        api_key = custom_header or os.environ.get("GROQ_API_KEY", "")

    try:
        from ai_engine import analyze_stock as run_analysis
        result = run_analysis(ticker=ticker, language=language, api_key=api_key, model=model)
        return safe_jsonify({
            'status': 'success',
            'source': result.get('source', 'ai'),
            'ticker': result['ticker'],
            'language': result['language'],
            'master_report': result['master_report'],
            'dashboard_report': result.get('dashboard_report', ''),
            'fundamental_report': result.get('fundamental_report', ''),
            'technical_report': result.get('technical_report', ''),
            'stock_data': result.get('stock_data', {}),
        })
    except ValueError as ve:
        err_msg = str(ve)
        if "UNKNOWN_SYMBOL" in err_msg:
            return safe_jsonify({'status': 'error', 'error_code': 'UNKNOWN_SYMBOL', 'message': err_msg}, status=404)
        if "DATA_COVERAGE_ERROR" in err_msg or "INSUFFICIENT" in err_msg:
            return safe_jsonify({'status': 'error', 'error_code': 'DATA_COVERAGE_ERROR', 'message': err_msg}, status=422)
        return safe_jsonify({'status': 'error', 'error_code': 'INVALID_REQUEST', 'message': err_msg}, status=400)
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/universe/stats', methods=['GET'])
def get_universe_stats_route():
    try:
        from ticker_universe import get_universe_stats
        stats = get_universe_stats()
        return safe_jsonify({'status': 'success', 'stats': stats})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/universe/refresh', methods=['POST'])
def refresh_universe_route():
    try:
        from ticker_universe import sync_universe
        res = sync_universe()
        return safe_jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/predict', methods=['GET', 'POST'])
def predict_stock_route():
    body = request.get_json(silent=True) or {}
    ticker = request.args.get('ticker') or body.get('ticker', 'TCS')
    ticker = str(ticker).strip().upper()
    custom_key = (
        request.headers.get('X-AI-Key', '').strip()
        or request.headers.get('X-Groq-Key', '').strip()
        or request.args.get('api_key', '').strip()
        or body.get('api_key', '').strip()
    )
    try:
        from ml_pipeline import predict_stock
        pred = predict_stock(ticker, custom_api_key=custom_key)
        if pred.get("status") == "error":
            err_code = pred.get("error_code", "ERROR")
            if err_code == "UNKNOWN_SYMBOL":
                status_code = 404
            elif err_code in ["DATA_COVERAGE_ERROR", "INSUFFICIENT_HISTORY", "INSUFFICIENT_DATA"]:
                status_code = 422
            else:
                status_code = 400
            return safe_jsonify(pred, status=status_code)
        return safe_jsonify({'status': 'success', 'data': pred})
    except ValueError as ve:
        err_msg = str(ve)
        if "UNKNOWN_SYMBOL" in err_msg:
            status_code = 404
            err_code = "UNKNOWN_SYMBOL"
        elif "DATA_COVERAGE_ERROR" in err_msg or "INSUFFICIENT" in err_msg:
            status_code = 422
            err_code = "DATA_COVERAGE_ERROR"
        else:
            status_code = 400
            err_code = "INVALID_REQUEST"
        return safe_jsonify({
            'status': 'error',
            'error_code': err_code,
            'message': err_msg
        }, status=status_code)
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/options-chain', methods=['GET'])
def get_options_chain_route():
    ticker = request.args.get('ticker', 'NIFTY').strip().upper()
    try:
        from options_engine import get_options_chain
        chain = get_options_chain(ticker)
        return safe_jsonify({'status': 'success', 'data': chain})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/screener', methods=['GET'])
def get_screener_route():
    strategy = request.args.get('strategy', 'ALL').strip().upper()
    try:
        from screener import scan_stocks
        from market_guard import MarketError
        results = scan_stocks(strategy)
        return safe_jsonify(results)
    except Exception as me:
        from market_guard import MarketError
        if isinstance(me, MarketError):
            return safe_jsonify({
                'status': 'error',
                'state': 'timeout' if me.code == "SCREENER_TIMEOUT" else 'unavailable',
                'error_code': me.code,
                'message': str(me)
            }, status=me.status)
        return safe_jsonify({'status': 'error', 'state': 'error', 'message': str(me)}, status=500)


@app.route('/api/webhook/order', methods=['POST'])
def webhook_order_route():
    payload = request.get_json(silent=True) or request.form.to_dict() or {}
    symbol = str(payload.get("symbol") or payload.get("ticker") or "").strip().upper()
    if not symbol:
        return safe_jsonify({'status': 'error', 'error_code': 'INVALID_REQUEST', 'message': 'symbol or ticker is required'}, status=400)

    try:
        from ticker_universe import resolve_and_validate_symbol
        is_valid, resolved_sym, meta = resolve_and_validate_symbol(symbol)
        if not is_valid:
            return safe_jsonify({
                'status': 'error',
                'error_code': 'UNKNOWN_SYMBOL',
                'message': f"Symbol '{symbol}' not found in authoritative instrument master."
            }, status=404)

        price = float(payload.get("price", 0.0))
        if price <= 0 or not math.isfinite(price):
            return safe_jsonify({
                'status': 'error',
                'error_code': 'INVALID_PRICE',
                'message': f"Order rejected: Price must be a finite positive number, received: {price}"
            }, status=400)

        from broker_gateway import process_webhook_order
        res = process_webhook_order(payload)
        status_code = 200 if res.get("status") == "success" else 400
        return safe_jsonify(res, status=status_code)
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/broker/status', methods=['GET'])
def get_broker_status_route():
    try:
        from broker_gateway import get_broker_status
        res = get_broker_status()
        return safe_jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/models/retrain', methods=['POST'])
def retrain_model_route():
    try:
        from ml_pipeline import run_auto_training_job
        res = run_auto_training_job()
        return safe_jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/models/history', methods=['GET'])
def get_model_history_route():
    try:
        from ml_pipeline import list_all_models
        res = list_all_models()
        return safe_jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/models/rollback', methods=['POST'])
def rollback_model_route():
    payload = request.json or {}
    target_version = payload.get('target_version', '').strip()
    if not target_version:
        return safe_jsonify({'status': 'error', 'message': 'target_version is required'}, status=400)

    try:
        from ml_pipeline import rollback_model
        res = rollback_model(target_version)
        return safe_jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/ai-status', methods=['GET', 'POST'])
def ai_status_route():
    payload = request.json or {} if request.is_json else {}
    if 'api_key' in payload:
        api_key = str(payload.get('api_key') or '').strip()
    else:
        custom_header = request.headers.get('X-AI-Key', '').strip() or request.headers.get('X-Groq-Key', '').strip()
        api_key = custom_header or os.environ.get("GROQ_API_KEY", "")

    if not api_key:
        return safe_jsonify({'status': 'error', 'online': False, 'message': 'No API Key configured'})

    try:
        from groq import Groq
        client = Groq(api_key=api_key, timeout=4.0)
        avail = [m.id for m in client.models.list().data]
        test_model = "openai/gpt-oss-120b" if "openai/gpt-oss-120b" in avail else (
            "qwen/qwen3.8-27b" if "qwen/qwen3.8-27b" in avail else (
                "llama-3.3-70b-versatile" if "llama-3.3-70b-versatile" in avail else avail[0]
            )
        )
        res = client.chat.completions.create(
            model=test_model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5
        )
        return safe_jsonify({
            'status': 'success',
            'online': True,
            'active_key_preview': f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "***",
            'models': [
                {'id': 'openai/gpt-oss-120b', 'name': 'AI 1: Groq GPT-OSS 120B (Institutional Quantitative Core)'},
                {'id': 'qwen/qwen3.8-27b', 'name': 'AI 2: Groq Qwen 3.8 27B (High-Speed Strategy Engine)'},
                {'id': 'openai/gpt-oss-20b', 'name': 'AI 3: Groq GPT-OSS 20B (Low-Latency Execution Engine)'}
            ]
        })
    except Exception as e:
        return safe_jsonify({'status': 'error', 'online': False, 'message': str(e)})


@app.route('/api/top-value-stocks', methods=['GET'])
def get_top_value_stocks_route():
    try:
        from stock_data import get_highest_share_price_stocks
        data = get_highest_share_price_stocks()
        return safe_jsonify({'status': 'success', 'data': data})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/all-india-indices', methods=['GET'])
def get_all_india_indices_route():
    try:
        from stock_data import get_all_india_indices
        data = get_all_india_indices()
        return safe_jsonify({'status': 'success', 'data': data})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


@app.route('/api/galaxy-nodes', methods=['GET'])
def get_galaxy_nodes_route():
    try:
        from stock_data import get_multi_asset_galaxy_nodes
        data = get_multi_asset_galaxy_nodes()
        return safe_jsonify({'status': 'success', 'data': data})
    except Exception as e:
        return safe_jsonify({'status': 'error', 'message': str(e)}, status=500)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"\n{'='*55}")
    print(f"  [*] Indian Stock Intelligence Platform")
    print(f"  [AI] Engine : Groq Llama 3.3 70B (DIRECT API)")
    print(f"  [X] CrewAI  : REMOVED")
    print(f"  [X] Google  : REMOVED")
    print(f"  [>] URL     : http://localhost:{port}")
    print(f"{'='*55}\n")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)

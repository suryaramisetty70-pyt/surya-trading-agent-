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
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from dotenv import load_dotenv
load_dotenv(override=False)   # .env won't override what we already set above

# ── App setup ─────────────────────────────────────────────────────────────────
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')

if os.path.exists(FRONTEND_DIST):
    app = Flask(__name__, static_folder=os.path.join(FRONTEND_DIST, 'assets'))
else:
    app = Flask(__name__, template_folder='templates', static_folder='static')

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
        return jsonify({'status': 'success', 'data': data})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/top-stocks', methods=['GET'])
def get_top_stocks_route():
    try:
        from stock_data import get_top_5_stocks
        top_stocks = get_top_5_stocks()
        return jsonify({'status': 'success', 'stocks': top_stocks})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/analyze', methods=['POST'])
def analyze_stock():
    payload = request.json or {}
    ticker = payload.get('ticker', 'RELIANCE').strip().upper()
    language = payload.get('language', 'English').strip()
    model = payload.get('model', 'llama-3.3-70b-versatile').strip()
    custom_key = payload.get('api_key', '').strip() or request.headers.get('X-AI-Key', '').strip() or request.headers.get('X-Groq-Key', '').strip()
    api_key = custom_key or os.environ.get("GROQ_API_KEY", "")

    if not api_key or api_key == "PASTE_YOUR_KEY_HERE":
        return jsonify({
            'status': 'error',
            'message': 'Groq API key is not set! Please enter your API key in Settings.'
        }), 400

    try:
        from ai_engine import analyze_stock as run_analysis
        result = run_analysis(ticker=ticker, language=language, api_key=api_key, model=model)
        return jsonify({
            'status': 'success',
            'ticker': result['ticker'],
            'language': result['language'],
            'master_report': result['master_report'],
            'dashboard_report': result['dashboard_report'],
            'fundamental_report': result['fundamental_report'],
            'technical_report': result['technical_report'],
            'stock_data': result['stock_data'],
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/universe/stats', methods=['GET'])
def get_universe_stats_route():
    try:
        from ticker_universe import get_universe_stats
        stats = get_universe_stats()
        return jsonify({'status': 'success', 'stats': stats})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/universe/refresh', methods=['POST'])
def refresh_universe_route():
    try:
        from ticker_universe import sync_universe
        res = sync_universe()
        return jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


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
        return jsonify({'status': 'success', 'data': pred})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/options-chain', methods=['GET'])
def get_options_chain_route():
    ticker = request.args.get('ticker', 'NIFTY').strip().upper()
    try:
        from options_engine import get_options_chain
        chain = get_options_chain(ticker)
        return jsonify({'status': 'success', 'data': chain})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/screener', methods=['GET'])
def get_screener_route():
    strategy = request.args.get('strategy', 'ALL').strip().upper()
    try:
        from screener import scan_stocks
        results = scan_stocks(strategy)
        return jsonify({'status': 'success', 'data': results})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/webhook/order', methods=['POST'])
def webhook_order_route():
    payload = request.get_json(silent=True) or request.form.to_dict() or {}
    try:
        from broker_gateway import process_webhook_order
        res = process_webhook_order(payload)
        return jsonify(res)
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/broker/status', methods=['GET'])
def get_broker_status_route():
    try:
        from broker_gateway import get_broker_status
        res = get_broker_status()
        return jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/models/retrain', methods=['POST'])
def retrain_model_route():
    try:
        from ml_pipeline import run_auto_training_job
        res = run_auto_training_job()
        return jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/models/history', methods=['GET'])
def get_model_history_route():
    try:
        from ml_pipeline import list_all_models
        res = list_all_models()
        return jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/models/rollback', methods=['POST'])
def rollback_model_route():
    payload = request.json or {}
    target_version = payload.get('target_version', '').strip()
    if not target_version:
        return jsonify({'status': 'error', 'message': 'target_version is required'}), 400

    try:
        from ml_pipeline import rollback_model
        res = rollback_model(target_version)
        return jsonify({'status': 'success', 'data': res})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/ai-status', methods=['GET', 'POST'])
def ai_status_route():
    payload = request.json or {} if request.is_json else {}
    custom_key = payload.get('api_key', '').strip() or request.headers.get('X-AI-Key', '').strip() or request.headers.get('X-Groq-Key', '').strip()
    api_key = custom_key or os.environ.get("GROQ_API_KEY", "")

    if not api_key:
        return jsonify({'status': 'error', 'online': False, 'message': 'No API Key configured'})

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        res = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5
        )
        return jsonify({
            'status': 'success',
            'online': True,
            'active_key_preview': f"{api_key[:6]}...{api_key[-4:]}" if len(api_key) > 10 else "***",
            'models': [
                {'id': 'llama-3.3-70b-versatile', 'name': 'AI 1: Groq Llama 3.3 70B (Ultra-Fast Institutional)'},
                {'id': 'mixtral-8x7b-32768', 'name': 'AI 2: Groq Mixtral 8x7B (High-Speed Strategy Engine)'},
                {'id': 'deepseek-r1-distill-llama-70b', 'name': 'AI 3: DeepSeek R1 70B (Deep Reasoning)'}
            ]
        })
    except Exception as e:
        return jsonify({'status': 'error', 'online': False, 'message': str(e)})


@app.route('/api/top-value-stocks', methods=['GET'])
def get_top_value_stocks_route():
    try:
        from stock_data import get_highest_share_price_stocks
        data = get_highest_share_price_stocks()
        return jsonify({'status': 'success', 'data': data})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/all-india-indices', methods=['GET'])
def get_all_india_indices_route():
    try:
        from stock_data import get_all_india_indices
        data = get_all_india_indices()
        return jsonify({'status': 'success', 'data': data})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/galaxy-nodes', methods=['GET'])
def get_galaxy_nodes_route():
    try:
        from stock_data import get_multi_asset_galaxy_nodes
        data = get_multi_asset_galaxy_nodes()
        return jsonify({'status': 'success', 'data': data})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


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

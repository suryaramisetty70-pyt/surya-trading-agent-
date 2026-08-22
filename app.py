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
from flask import Flask, render_template, request, jsonify, send_file
from dotenv import load_dotenv
load_dotenv(override=False)   # .env won't override what we already set above

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__, template_folder='templates', static_folder='static')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response


@app.route('/')
def index():
    return render_template('index.html')


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
    api_key = os.environ.get("GROQ_API_KEY", "")

    if not api_key or api_key == "PASTE_YOUR_KEY_HERE":
        return jsonify({
            'status': 'error',
            'message': 'Groq API key is not set! Please update the GROQ_API_KEY in your .env file.'
        }), 400

    try:
        from ai_engine import analyze_stock as run_analysis
        result = run_analysis(ticker=ticker, language=language, api_key=api_key)
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

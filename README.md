# 🚀 MAX MARKET — Institutional Pro Hybrid ML Trade Prediction & Intelligence Platform

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.1-purple.svg)](https://vitejs.dev)
[![Flask](https://img.shields.io/badge/Flask-3.0-lightgrey.svg)](https://palletsprojects.com/p/flask/)
[![Groq AI](https://img.shields.io/badge/Groq%20AI-Llama%203.3%2070B-orange.svg)](https://groq.com)
[![Status](https://img.shields.io/badge/Status-100%25%20Verified%20%26%20Production%20Ready-brightgreen.svg)]()

MAX MARKET is an institutional-grade algorithmic equity trading terminal and hybrid machine learning forecasting platform tailored for the Indian Capital Markets (NSE/BSE). It integrates high-speed quantitative multi-model ensembles, real-time exchange data feeds, automated trading webhooks, risk management engines, and a plain-English explainable AI reasoning layer.

---

## 🏛️ System Architecture Overview

```
                                  MAX MARKET TERMINAL
                                (React 18 + Vite + Tailwind)
                                            │
               ┌────────────────────────────┼───────────────────────────┐
               ▼                            ▼                           ▼
     [Interactive Terminal]         [3D Market Globe]         [Quick Stock Drawer]
   (Movers, Watchlist, Orders)      (Sector Rotations)        (Technicals, Books)
               │                            │                           │
               └────────────────────────────┼───────────────────────────┘
                                            │ REST API / WebSocket
                                            ▼
                           MAX MARKET BACKEND ENGINE (Flask + Gunicorn)
                                            │
        ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
        ▼                   ▼                               ▼                   ▼
 [Hybrid ML Pipeline] [AI Explainer]                [Exchange Ingestion]  [Broker Gateway]
 - GBDT Classifier    - Groq Llama 3.3 70B          - yfinance + NSE API  - TradingView Webhook
 - 4-Horizon Regr.    - DeepSeek R1 Reasoning       - 2,587 Equities DB   - Dhan Sandbox
 - Squeeze Detector   - Deterministic Fallback      - Real Options Chain  - Virtual Paper Wallet
 - Meta-Aggregator    - Token Quota Hot-Swap        - 52W High Screener   - Kill Switch
```

---

## ⚡ Core Subsystems & Technical Details

### 1. 🧠 Pro-Level Hybrid ML Model Trade Prediction System (`ml_pipeline.py`)
- **Model 1: Directional GBDT Classifier** (`HistGradientBoostingClassifier`):
  Evaluates 13 non-linear quantitative tensors (Returns 1D/5D/20D, SMA 20/50/200 price ratios, RSI-14, MACD signal & histogram, Bollinger %B & bandwidth, normalized ATR%, and volume participation). Predicts the probability of directional shift over a 5-day horizon.
- **Model 2: Multi-Horizon Volatility Regressors** (`HistGradientBoostingRegressor`):
  Calibrates forward expected price paths across 4 distinct institutional horizons:
  - **1-Day Horizon (T+1)**: Intraday test price & overnight drift expectation.
  - **5-Day Horizon (T+5)**: Swing expansion target corridor.
  - **15-Day Horizon (T+15)**: Bi-weekly structural breakout projection.
  - **30-Day Horizon (T+30)**: Monthly position path.
- **Model 3: Mean-Reversion & Volatility Squeeze Engine**:
  Monitors dynamic Bollinger Band compression and statistical standard deviation envelopes to catch volatility expansion breakouts before standard indicators.
- **Model 4: Consensus Meta-Aggregator**:
  Synthesizes sub-model outputs into calibrated trade actions: `STRONG BUY`, `BUY`, `ACCUMULATE`, `HOLD / NEUTRAL`, `REDUCE`, `SELL`, `STRONG SHORT`. Computes dynamic 1.2x ATR stop-loss floor, Bull Target corridor, and dynamic Risk:Reward ratios.
- **Purged Cross-Validation Gate**:
  Includes auto-training routines with chronological embargoes to eliminate lookahead bias. Evaluates Hit Rate, Sharpe Ratio, and Sortino Ratio before promoting models to production pointer (`models/current.json`).

### 2. 💡 Plain-English AI Prediction Explainer Feature
- **Problem Solved**: Quantitative ML models often produce raw numbers and tensors that traders cannot easily decipher.
- **AI Explainer Breakdown**:
  - **Headline Summary**: 1-2 sentence executive verdict explaining what is happening.
  - **Why The Models Decided This**: Clear breakdown of what each sub-model observed (momentum continuation, moving average defense, volume influx).
  - **Multi-Horizon Roadmap**: Step-by-step price targets from 1D to 30D.
  - **Risk & Stop-Loss Rationale**: Explains why the stop-loss is placed at that exact rupee price to protect capital while avoiding normal market noise.
  - **Actionable Trader Advice**: Easy-to-follow guidelines for beginners and pros.
- **Resilient Dual-Mode Execution**:
  - Primary: Ultra-fast LLM inference via **Groq Llama 3.3 70B** / **DeepSeek R1**.
  - Fallback: Deterministic quantitative reasoning engine that generates full plain-English explanations even if the user has no API key or token limits are exceeded.

### 3. 🔑 In-App AI API Key Hot-Swap & Token Quota Manager
- **Settings AI Manager (`/terminal#Settings:AI`)**:
  - Dedicated input boxes for **Groq API Key** (`gsk_...`), **Google Gemini API Key** (`AIzaSy...`), and **OpenAI API Key** (`sk-...`).
  - Active provider toggle: Switch between Groq, Gemini, or OpenAI with one click.
  - **Zero-Restart Hot-Swapping**: When free token quotas are exhausted during live trading, simply paste a new API key in Settings and click "Save & Activate". The application immediately transmits the key via `X-AI-Key` headers without needing backend restarts or `.env` edits.
  - Real-time connection test button with millisecond latency verification.
  - TopBar quick-access `Key` button for 5-second in-trade key replacement.

### 4. 📊 Live Market Data & Real Exchange Ticker Universe (`stock_data.py`, `ticker_universe.py`)
- Real-time OHLCV, volume, market cap, and trading statistics for 2,587+ NSE/BSE listed equities.
- Real exchange-verified fundamentals: P/E (TTM), P/B, ROE%, ROCE%, EPS, Revenue (Cr), Profit Margin%, Dividend Yield%, and Debt/Equity.
- Live Derivatives Options Chain: Strike prices, Open Interest (OI), Change in OI, implied volatility, and Put-Call Ratio (PCR).
- Market screeners: 52-Week High Breakouts, Volume Surge Equities, and Golden Cross (50/200 SMA) filters.

### 5. ⚡ Algorithmic Broker Gateway & Webhook Listener (`broker_gateway.py`)
- **TradingView Webhook Listener (`POST /api/webhook/order`)**:
  Accepts automated JSON alerts from TradingView strategy indicators or Python algorithmic bots and translates them into paper wallet trades.
- Virtual Paper Wallet margin simulator with cash balance tracking, P&L calculation, trade book history, and CSV export.
- Safety Kill Switch to immediately suspend all order routing in volatile market regimes.

---

## 🛠️ Quick Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/suryaramisetty70-pyt/surya-trading-agent-.git
cd surya-trading-agent-
```

### 2. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 3. (Optional) Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=5000
GROQ_API_KEY=gsk_your_groq_api_key_here
```
*(Note: You can also leave this blank and enter your API key directly in the web UI Settings!)*

### 4. Start the Application
```bash
python app.py
```
Open your browser at: **`http://localhost:5000/`** (or **`http://localhost:8080/`** if running Vite dev server).

---

## 🌐 24/7 Free Deployment Guide (Always Alive Without Sleeping)

Most traditional free hosts (like Render or Glitch free tiers) put applications to sleep after 15 minutes of inactivity. Below are the **tested, reliable methods** to host MAX MARKET **100% free and keep it running 24/7 without sleeping**:

### 🏆 Recommended Solution 1: Hugging Face Spaces (100% Free 24/7, NEVER Sleeps)
Hugging Face Spaces provides a permanent free Docker / Python container that **never idles or goes to sleep**:
1. Create a free account at [huggingface.co](https://huggingface.co).
2. Go to **Spaces** → Click **Create new Space**.
3. Name your space (e.g. `max-market`).
4. Select **Docker** as the Space SDK → Choose **Blank**.
5. Set Space hardware to **CPU Basic (Free - 2 vCPU, 16GB RAM)**.
6. Push this repository to your Hugging Face Space repository:
   ```bash
   git remote add hf https://huggingface.co/spaces/YOUR_USERNAME/max-market
   git push hf main
   ```
7. Under Space Settings → **Variables and secrets**, add `GROQ_API_KEY`.
8. Your platform will be running **24/7/365 without ever sleeping**!

---

### 🥈 Recommended Solution 2: Render (Free Tier) + Free UptimeRobot Keep-Alive Bot
If deploying on [Render.com](https://render.com):
1. Create a free account on Render.
2. Click **New** → **Web Service** → Connect your GitHub repository `surya-trading-agent-`.
3. Set Environment to **Python 3**.
4. Set Build Command: `pip install -r requirements.txt`
5. Set Start Command: `gunicorn app:app`
6. Add Environment Variable: `GROQ_API_KEY` = your key.
7. Click **Create Web Service**. Render gives you a free HTTPS URL: `https://max-market.onrender.com`.

**How to prevent Render from sleeping (24/7 Free Keep-Alive):**
Render puts free apps to sleep after 15 minutes of silence. You can prevent this for free:
1. Go to [UptimeRobot.com](https://uptimerobot.com) or [cron-job.org](https://cron-job.org) (both 100% free forever).
2. Create a new HTTP Monitor pointing to: `https://max-market.onrender.com/api/universe/stats`
3. Set the monitoring interval to **every 5 minutes**.
4. Because the health endpoint receives a lightweight request every 5 minutes, Render will **NEVER sleep and will remain 100% awake 24/7**!

---

### 🥉 Recommended Solution 3: Oracle Cloud Free Tier (Forever Free Linux VPS)
Oracle Cloud offers an "Always Free" tier that gives:
- 4 ARM Ampere CPU Cores + 24 GB RAM.
- A permanent Ubuntu Linux Virtual Machine that is 100% free forever and **never sleeps**.
- Run `git clone`, `docker build -t max-market .`, and `docker run -d -p 80:5000 max-market` to have a dedicated institutional terminal running indefinitely.

---

### 🐳 Recommended Solution 4: Self-Hosted Docker
A production `Dockerfile` is included in this repository:
```bash
# Build Docker image
docker build -t max-market .

# Run container on port 5000
docker run -d -p 5000:5000 -e GROQ_API_KEY="gsk_..." --name max-market max-market
```

---

## 📡 REST API Reference

| Endpoint | Method | Parameters | Description |
| :--- | :---: | :--- | :--- |
| `/api/predict` | `GET/POST` | `ticker` (e.g. `RELIANCE`) | Returns Hybrid ML predictions, multi-horizon forecasts (1D, 5D, 15D, 30D), risk levels, and plain-English AI explanations. |
| `/api/stock-data` | `GET` | `ticker` (e.g. `TCS`) | Returns live price, candlestick history, moving averages, and full exchange fundamentals. |
| `/api/options-chain` | `GET` | `ticker` (e.g. `NIFTY`) | Returns live Call/Put derivatives option chain, Open Interest, and PCR. |
| `/api/screener` | `GET` | `strategy` (`52W_HIGH`, `VOLUME_SURGE`, `GOLDEN_CROSS`) | Returns filtered equities matching quantitative technical criteria. |
| `/api/top-stocks` | `GET` | - | Returns market overview for top high-volume equities. |
| `/api/all-india-indices` | `GET` | - | Returns real-time quotes for Nifty 50, Sensex, Bank Nifty, and India VIX. |
| `/api/webhook/order` | `POST` | `symbol`, `action`, `quantity`, `price` | Inbound webhook bridge for TradingView alerts and automated trading bots. |
| `/api/ai-status` | `POST` | `api_key` | Verifies connection to Groq / DeepSeek inference engines. |
| `/api/models/history` | `GET` | - | Returns quantitative model registry, Purged CV metrics, and version history. |

---

## 🛡️ License & Attributions
- Market Data: NSE India API, Yahoo Finance, Google Finance.
- AI Reasoning: Powered by Groq Llama 3.3 70B & DeepSeek R1.
- Built for precision, speed, and institutional-grade algorithmic execution.

# 📊 Surya Trading Agent — Indian Stock Intelligence Platform

An AI-powered Indian stock market analysis platform using **Groq Llama 3.3 70B** for lightning-fast stock intelligence reports.

## Features
- 🔴 **Live Market Data** — NSE India API + Yahoo Finance + Google Finance news
- 🤖 **AI Analysis** — 4 specialist agents running in parallel (3x faster)
- 🌐 **Multi-Language Reports** — English, Hindi, Telugu, Tamil
- 📥 **Download Reports** — Export full analysis as Markdown
- 📈 **Technical Analysis** — RSI, EMA 20/50/200, Support/Resistance
- 📊 **Fundamental Analysis** — P/E, ROE, Debt/Equity, Analyst consensus
- 📰 **Live News** — Latest headlines from Google Finance & Yahoo Finance

## Tech Stack
- **AI**: Groq Llama 3.3 70B (direct API — no middleware)
- **Backend**: Flask (Python)
- **Market Data**: NSE India API + yfinance
- **Frontend**: HTML + Vanilla JS

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/suryaramisetty70-pyt/surya-trading-agent-.git
cd surya-trading-agent-
```

### 2. Install dependencies
```bash
pip install groq flask yfinance pandas numpy requests python-dotenv wikipedia
```

### 3. Set your Groq API Key
Create a `.env` file:
```
GROQ_API_KEY=your_groq_api_key_here
```
Get your free key at: https://console.groq.com/keys

### 4. Run the app
```bash
python app.py
```
Open: http://localhost:8080

## Usage
1. Enter an NSE stock symbol (e.g. `RELIANCE`, `TCS`, `INFY`, `HDFCBANK`)
2. Select report language (English / Hindi / Telugu / Tamil)
3. Click **Run AI Analysis**
4. Download the full report as `.md`

## Supported Stocks
Any NSE-listed stock symbol — RELIANCE, TCS, INFY, WIPRO, HDFCBANK, ICICIBANK, SBIN, BAJFINANCE, TATAMOTORS, ADANIENT, etc.

---
Made with Groq AI | NSE India | Yahoo Finance | Google Finance

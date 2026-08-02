"""
Groq-powered Stock Intelligence Engine
- Pure Groq API (NO CrewAI, NO Google AI, NO LiteLLM)
- Parallel agent execution for 3x faster results
- Live news + analyst data + quarterly financials from Yahoo/Google Finance
"""

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from groq import Groq
from stock_data import get_stock_data

MODEL = "llama-3.3-70b-versatile"

LANGUAGE_INSTRUCTIONS = {
    "English": "Write the entire report in clear professional English.",
    "Hindi": "पूरी रिपोर्ट हिंदी में लिखें। सभी शीर्षक और विवरण हिंदी में होने चाहिए।",
    "Telugu": "మొత్తం నివేదికను తెలుగులో రాయండి. అన్ని శీర్షికలు మరియు వివరాలు తెలుగులో ఉండాలి.",
    "Tamil": "முழு அறிக்கையும் தமிழில் எழுதவும். அனைத்து தலைப்புகளும் விவரங்களும் தமிழில் இருக்க வேண்டும்.",
}


def _call_groq(system: str, prompt: str, api_key: str, max_tokens: int = 2000) -> str:
    """Direct Groq API call — no wrappers."""
    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


def _format_news(news_list: list) -> str:
    if not news_list:
        return "No recent news available."
    lines = []
    for i, n in enumerate(news_list[:5], 1):
        lines.append(f"{i}. [{n.get('date','')}] {n.get('title','')} — {n.get('source','')}")
        if n.get("summary"):
            lines.append(f"   {n['summary'][:150]}...")
    return "\n".join(lines)


def _format_analyst(analyst_data: dict, rating: str, count: int, target: float, target_high: float, target_low: float) -> str:
    if not analyst_data and not rating:
        return "No analyst data available."
    sb = analyst_data.get("strong_buy", 0)
    b = analyst_data.get("buy", 0)
    h = analyst_data.get("hold", 0)
    s = analyst_data.get("sell", 0)
    ss = analyst_data.get("strong_sell", 0)
    return (
        f"Consensus: {rating.upper()} ({count} analysts)\n"
        f"Strong Buy: {sb} | Buy: {b} | Hold: {h} | Sell: {s} | Strong Sell: {ss}\n"
        f"Price Target: Mean ₹{target} | High ₹{target_high} | Low ₹{target_low}"
    )


def _format_quarterly(quarterly: list) -> str:
    if not quarterly:
        return "Quarterly data not available."
    lines = [f"Q{i+1} ({q['quarter']}): ₹{q['revenue_cr']} Cr" for i, q in enumerate(quarterly)]
    return " | ".join(lines)


# ── AGENT 1: Market Dashboard ─────────────────────────────────────────────────
def _agent_dashboard(data: dict, api_key: str) -> str:
    news_text = _format_news(data.get("news_headlines", []))
    system = "You are a senior Indian stock market analyst. Create a precise market dashboard with real data. Use Rs for prices. Keep it concise and factual."
    prompt = f"""
Create a Real-Time Market Dashboard for {data['company_name']} ({data['ticker']}.NS):

LIVE MARKET DATA:
- Current Price: Rs {data['current_price']} | Open: Rs {data['open_price']}
- Day Range: Rs {data['day_low']} - Rs {data['day_high']}
- Change: Rs {data['change']} ({data['change_pct']}%)
- Volume: {data['volume']:,} (Avg: {data['avg_volume']:,})
- Market Cap: Rs {data['market_cap_cr']} Crores
- 52W High: Rs {data['week_52_high']} | 52W Low: Rs {data['week_52_low']}
- Beta: {data.get('beta', 'N/A')} | Sector: {data['sector']}

LATEST NEWS & MARKET SENTIMENT:
{news_text}

Write dashboard covering:
1. Current market sentiment (Bullish/Bearish/Neutral) with reasoning
2. Volume analysis vs average (above/below and what it signals)
3. 52-week range positioning (% from high and low)
4. Key news impact on stock today
5. Sector & market context
"""
    return _call_groq(system, prompt, api_key, max_tokens=1200)


# ── AGENT 2: Fundamental Analysis ─────────────────────────────────────────────
def _agent_fundamental(data: dict, api_key: str) -> str:
    analyst_text = _format_analyst(
        data.get("analyst_data", {}),
        data.get("analyst_rating", ""),
        data.get("analyst_count", 0),
        data.get("target_price", 0),
        data.get("target_high", 0),
        data.get("target_low", 0),
    )
    quarterly_text = _format_quarterly(data.get("quarterly_revenue", []))
    system = "You are a CFA charterholder specializing in Indian equity research. Give sharp, data-driven fundamental analysis. Use Rs for prices."
    prompt = f"""
Fundamental Analysis for {data['company_name']} ({data['ticker']}):

BUSINESS: {data['summary'][:400]}
Sector: {data['sector']} | Industry: {data['industry']} | Employees: {data.get('employees','N/A')}

FINANCIAL METRICS:
- Price: Rs {data['current_price']} | EPS: Rs {data['eps']} | Book Value: Rs {data['book_value']}
- P/E: {data['pe_ratio']} | Forward P/E: {data['forward_pe']} | P/B: {data['pb_ratio']}
- ROE: {data['roe']}% | ROCE: {data['roce']}% | Profit Margin: {data['profit_margin']}%
- Operating Margin: {data['operating_margin']}% | Free Cash Flow: Rs {data['free_cashflow_cr']} Cr
- Debt/Equity: {data['debt_equity']} | Dividend Yield: {data['dividend_yield']}%
- Market Cap: Rs {data['market_cap_cr']} Cr | Revenue: Rs {data['revenue_cr']} Cr

QUARTERLY REVENUE TREND:
{quarterly_text}

INSTITUTIONAL HOLDINGS:
- Institutional: {data['institutional_pct']}% | Promoter/Insider: {data['promoter_pct']}%

ANALYST CONSENSUS:
{analyst_text}

Provide:
1. Business moat & competitive strength (score /10)
2. Financial health scorecard (each metric: Strong/Average/Weak)
3. Valuation verdict (Cheap/Fair/Expensive vs sector)
4. Growth catalysts & key risks
5. Fundamental rating: STRONG BUY / BUY / HOLD / SELL / STRONG SELL
"""
    return _call_groq(system, prompt, api_key, max_tokens=1200)


# ── AGENT 3: Technical Analysis ───────────────────────────────────────────────
def _agent_technical(data: dict, api_key: str) -> str:
    system = "You are a certified technical analyst (CFTe) for Indian equity markets. Give precise technical levels in Rs with clear signals."
    prompt = f"""
Technical Analysis for {data['company_name']} ({data['ticker']}):

LIVE PRICE DATA:
- Current: Rs {data['current_price']} | Open: Rs {data['open_price']}
- Day High: Rs {data['day_high']} | Day Low: Rs {data['day_low']}

TECHNICAL INDICATORS:
- RSI (14): {data['rsi_14']}
- EMA 20: Rs {data['ema_20']}
- EMA 50: Rs {data['ema_50']}
- EMA 200: Rs {data['ema_200']}
- 52W High: Rs {data['week_52_high']} | 52W Low: Rs {data['week_52_low']}
- Volume: {data['volume']:,} vs Avg {data['avg_volume']:,}
- Beta: {data.get('beta', 'N/A')}

Provide:
1. Trend: Above/below EMAs? Golden cross / Death cross?
2. RSI reading: Overbought/Oversold/Neutral + momentum
3. Support levels: 3 key levels in Rs
4. Resistance levels: 3 key levels in Rs
5. Trading signal with: Entry Rs, Stop-Loss Rs, Target 1 Rs, Target 2 Rs, Risk-Reward ratio
"""
    return _call_groq(system, prompt, api_key, max_tokens=1000)


# ── AGENT 4: Master Report (uses output of agents 1-3) ────────────────────────
def _agent_master_report(data: dict, dashboard: str, fundamental: str, technical: str, language: str, api_key: str) -> str:
    lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["English"])
    news_text = _format_news(data.get("news_headlines", []))
    analyst_text = _format_analyst(
        data.get("analyst_data", {}),
        data.get("analyst_rating", ""),
        data.get("analyst_count", 0),
        data.get("target_price", 0),
        data.get("target_high", 0),
        data.get("target_low", 0),
    )

    system = f"""You are India's top investment advisor. Write the complete report in {language} ONLY.
{lang_instruction}
Use Rs for all prices. Be specific with numbers. Format professionally."""

    prompt = f"""
Write a complete Master Investment Report for {data['company_name']} ({data['ticker']}).

CRITICAL: Write EVERY word in {language}. No English if language is not English.

LIVE STOCK DATA:
- Price: Rs {data['current_price']} ({data['change_pct']}% today)
- Market Cap: Rs {data['market_cap_cr']} Crores
- P/E: {data['pe_ratio']} | ROE: {data['roe']}% | Debt/Equity: {data['debt_equity']}
- 52W High: Rs {data['week_52_high']} | 52W Low: Rs {data['week_52_low']}
- RSI: {data['rsi_14']} | EMA20: Rs {data['ema_20']} | EMA200: Rs {data['ema_200']}
- Analyst Target: Rs {data['target_price']} | Rating: {data['analyst_rating']}

LATEST NEWS:
{news_text}

ANALYST CONSENSUS:
{analyst_text}

SPECIALIST RESEARCH:
=== MARKET DASHBOARD ===
{dashboard}

=== FUNDAMENTAL ANALYSIS ===
{fundamental}

=== TECHNICAL ANALYSIS ===
{technical}

WRITE COMPLETE REPORT WITH ALL SECTIONS IN {language.upper()}:

# Stock Intelligence Report: {data['company_name']} ({data['ticker']})
Date: {data['fetch_time']}

## 1. Executive Summary & Conviction Score (X/10)
## 2. Company Profile & Business Overview
## 3. Live Market Data & Key Metrics
## 4. Latest News & Market Sentiment
## 5. Fundamental Analysis Summary
## 6. Technical Analysis Summary  
## 7. Profit & Loss Scenarios:
   - Current Rate: Rs [price]
   - Buy Entry: Rs [entry] or dips to Rs [dip]
   - Short-Term Target (1-3 months): Rs [T1] (X% profit)
   - Medium-Term Target (6-12 months): Rs [T2] (X% profit)
   - Stop-Loss: Rs [SL] (X% max loss)
   - Risk-to-Reward: 1:X
## 8. Action Plan & Timeline
## 9. Risk Factors
## 10. Trading Rules & Risk Management
"""
    return _call_groq(system, prompt, api_key, max_tokens=4000)


# ── MAIN FUNCTION: Parallel Execution ────────────────────────────────────────
def analyze_stock(ticker: str, language: str = "English", api_key: str = "") -> dict:
    """
    Runs all 4 AI agents with parallel execution for 3x speed boost.
    Pure Groq SDK — NO CrewAI, NO Google, NO LiteLLM.
    """
    if not api_key:
        api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set.")

    # Step 1: Fetch live data (fast, local yfinance call)
    print(f"[AI] Fetching live market data for {ticker}...")
    data = get_stock_data(ticker)
    if not data.get("current_price"):
        raise ValueError(f"Could not fetch data for '{ticker}'. Check NSE symbol.")

    # Step 2: Run 3 agents IN PARALLEL using threads
    print(f"[AI] Running 3 specialist agents in parallel...")
    dashboard_result = None
    fundamental_result = None
    technical_result = None

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(_agent_dashboard, data, api_key): "dashboard",
            executor.submit(_agent_fundamental, data, api_key): "fundamental",
            executor.submit(_agent_technical, data, api_key): "technical",
        }
        for future in as_completed(futures):
            agent_name = futures[future]
            try:
                result = future.result()
                if agent_name == "dashboard":
                    dashboard_result = result
                elif agent_name == "fundamental":
                    fundamental_result = result
                elif agent_name == "technical":
                    technical_result = result
                print(f"[AI] {agent_name.capitalize()} agent done.")
            except Exception as e:
                print(f"[AI] {agent_name} agent error: {e}")
                if agent_name == "dashboard":
                    dashboard_result = f"Dashboard analysis unavailable: {e}"
                elif agent_name == "fundamental":
                    fundamental_result = f"Fundamental analysis unavailable: {e}"
                elif agent_name == "technical":
                    technical_result = f"Technical analysis unavailable: {e}"

    # Step 3: Master report (uses all 3 agent outputs)
    print(f"[AI] Generating master report in {language}...")
    master = _agent_master_report(data, dashboard_result, fundamental_result, technical_result, language, api_key)

    # Step 4: Save report file
    os.makedirs("output", exist_ok=True)
    report_path = os.path.join("output", "master_investment_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(master)

    print(f"[AI] Complete! Report saved.")

    return {
        "ticker": ticker,
        "language": language,
        "stock_data": data,
        "dashboard_report": dashboard_result,
        "fundamental_report": fundamental_result,
        "technical_report": technical_result,
        "master_report": master,
    }

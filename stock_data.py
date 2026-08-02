"""
Live Stock Data Engine — Multi-Source
Sources: NSE India Official API → Yahoo Finance fallback
No Google AI. Pure market data only.
"""

import os
import json
import time
import requests
import yfinance as yf
import pandas as pd
from datetime import datetime

# NSE India session (required for cookie-based auth)
NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.nseindia.com/",
    "Connection": "keep-alive",
}

def _get_nse_session():
    """Create a session with NSE India cookies."""
    session = requests.Session()
    session.headers.update(NSE_HEADERS)
    try:
        session.get("https://www.nseindia.com", timeout=8)
        time.sleep(0.5)
    except Exception:
        pass
    return session

def _fetch_nse_data(symbol: str) -> dict:
    """Fetch live data from NSE India official API."""
    try:
        session = _get_nse_session()
        url = f"https://www.nseindia.com/api/quote-equity?symbol={symbol.upper()}"
        r = session.get(url, timeout=8)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return {}

def _fetch_google_finance_news(symbol: str) -> list:
    """Scrape Google Finance for latest news headlines."""
    headlines = []
    try:
        url = f"https://www.google.com/finance/quote/{symbol.upper()}:NSE"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        }
        r = requests.get(url, headers=headers, timeout=8)
        if r.status_code == 200:
            text = r.text
            # Extract news titles from Google Finance HTML
            import re
            # Google Finance uses specific patterns for news titles
            matches = re.findall(r'"([^"]{20,150})"(?=.*?article)', text[:50000])
            seen = set()
            for m in matches[:8]:
                if m not in seen and not m.startswith("http") and len(m) > 25:
                    headlines.append({"title": m, "source": "Google Finance", "date": datetime.now().strftime("%Y-%m-%d")})
                    seen.add(m)
                if len(headlines) >= 5:
                    break
    except Exception:
        pass
    return headlines

def _compute_technicals(hist: pd.DataFrame) -> dict:
    """Compute RSI and EMAs from price history."""
    result = {"rsi_14": None, "ema_20": None, "ema_50": None, "ema_200": None,
              "week_52_high": None, "week_52_low": None}
    if hist is None or hist.empty or len(hist) < 20:
        return result
    closes = hist["Close"]
    delta = closes.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss
    result["rsi_14"] = round(float(100 - (100 / (1 + rs.iloc[-1]))), 2)
    result["ema_20"] = round(float(closes.ewm(span=20).mean().iloc[-1]), 2)
    if len(hist) > 50:
        result["ema_50"] = round(float(closes.ewm(span=50).mean().iloc[-1]), 2)
    if len(hist) > 200:
        result["ema_200"] = round(float(closes.ewm(span=200).mean().iloc[-1]), 2)
    year_data = hist.tail(252)
    result["week_52_high"] = round(float(year_data["High"].max()), 2)
    result["week_52_low"] = round(float(year_data["Low"].min()), 2)
    return result

def get_stock_data(ticker: str) -> dict:
    """
    Fetch comprehensive live data for an Indian stock.
    Primary: NSE India API | Secondary: Yahoo Finance | News: Google Finance
    """
    symbol = ticker.upper().replace(".NS", "").replace(".BO", "").strip()
    nse_symbol = f"{symbol}.NS"

    # ── Source 1: yfinance (Yahoo Finance — mirrors NSE/BSE real-time) ────────
    info = {}
    hist = None
    yf_news = []
    analyst_data = {}
    quarterly_revenue = []

    try:
        stock = yf.Ticker(nse_symbol)
        info = stock.info or {}
        hist = stock.history(period="1y")

        # News from Yahoo Finance
        raw_news = stock.news or []
        for item in raw_news[:6]:
            content = item.get("content", {})
            title = content.get("title") or item.get("title", "")
            summary = content.get("summary", "")
            source = ""
            try:
                source = content.get("provider", {}).get("displayName", "Yahoo Finance")
            except Exception:
                source = "Yahoo Finance"
            pub_date = content.get("pubDate", "")[:10] if content.get("pubDate") else ""
            if title:
                yf_news.append({"title": title, "summary": (summary or "")[:200], "source": source, "date": pub_date})

        # Analyst data
        try:
            recs = stock.recommendations
            if recs is not None and not recs.empty:
                latest = recs.tail(1).iloc[0]
                analyst_data = {
                    "strong_buy": int(latest.get("strongBuy", 0)),
                    "buy": int(latest.get("buy", 0)),
                    "hold": int(latest.get("hold", 0)),
                    "sell": int(latest.get("sell", 0)),
                    "strong_sell": int(latest.get("strongSell", 0)),
                }
        except Exception:
            pass

        # Quarterly revenue
        try:
            q_income = stock.quarterly_income_stmt
            if q_income is not None and not q_income.empty and "Total Revenue" in q_income.index:
                rev_row = q_income.loc["Total Revenue"]
                for col in list(rev_row.index)[:4]:
                    val = rev_row[col]
                    if pd.notna(val):
                        quarterly_revenue.append({"quarter": str(col)[:10], "revenue_cr": round(float(val) / 1e7, 2)})
        except Exception:
            pass

    except Exception as e:
        print(f"[Data] yfinance error: {e}")

    # ── Source 2: NSE India API (for precise live quote) ─────────────────────
    nse_data = _fetch_nse_data(symbol)
    nse_price_info = nse_data.get("priceInfo", {})
    nse_meta = nse_data.get("metadata", {})
    nse_industry_info = nse_data.get("industryInfo", {})

    # ── Source 3: Google Finance News ─────────────────────────────────────────
    google_news = _fetch_google_finance_news(symbol)

    # Merge news (Yahoo + Google, deduplicate)
    all_news = []
    seen_titles = set()
    for n in (yf_news + google_news):
        t = n.get("title", "").strip()
        if t and t not in seen_titles:
            all_news.append(n)
            seen_titles.add(t)
    all_news = all_news[:8]

    # ── Compute technicals ────────────────────────────────────────────────────
    techs = _compute_technicals(hist)

    # ── Build final price values (NSE API preferred, yfinance fallback) ───────
    def safe(val, default=0):
        try:
            v = float(val)
            return v if v == v else default   # NaN check
        except (TypeError, ValueError):
            return default

    current_price = (
        safe(nse_price_info.get("lastPrice"))
        or safe(info.get("currentPrice"))
        or safe(info.get("regularMarketPrice"))
    )
    prev_close = (
        safe(nse_price_info.get("previousClose"))
        or safe(info.get("previousClose"))
    )
    day_high = safe(nse_price_info.get("intraDayHighLow", {}).get("max")) or safe(info.get("dayHigh"))
    day_low  = safe(nse_price_info.get("intraDayHighLow", {}).get("min")) or safe(info.get("dayLow"))
    open_price = safe(nse_price_info.get("open")) or safe(info.get("open"))
    change = current_price - prev_close
    change_pct = (change / prev_close * 100) if prev_close else 0

    company_name = (
        nse_meta.get("companyName")
        or info.get("longName")
        or symbol
    )
    sector = (
        nse_industry_info.get("sector")
        or info.get("sector", "Unknown")
    )
    industry = (
        nse_industry_info.get("industry")
        or info.get("industry", "Unknown")
    )

    # ── Format the raw display text for the UI ────────────────────────────────
    raw_display = _format_raw_display(
        company_name=company_name,
        symbol=symbol,
        current_price=current_price,
        prev_close=prev_close,
        open_price=open_price,
        day_high=day_high,
        day_low=day_low,
        change=change,
        change_pct=change_pct,
        market_cap_cr=safe(info.get("marketCap")) / 1e7,
        pe_ratio=safe(info.get("trailingPE")),
        pb_ratio=safe(info.get("priceToBook")),
        roe=safe(info.get("returnOnEquity")) * 100,
        debt_equity=safe(info.get("debtToEquity")),
        dividend_yield=safe(info.get("dividendYield")) * 100,
        eps=safe(info.get("trailingEps")),
        revenue_cr=safe(info.get("totalRevenue")) / 1e7,
        profit_margin=safe(info.get("profitMargins")) * 100,
        sector=sector,
        industry=industry,
        volume=safe(info.get("volume")),
        avg_volume=safe(info.get("averageVolume")),
        rsi=techs["rsi_14"],
        ema20=techs["ema_20"],
        ema50=techs["ema_50"],
        ema200=techs["ema_200"],
        week_high=techs["week_52_high"],
        week_low=techs["week_52_low"],
        target_price=safe(info.get("targetMeanPrice")),
        analyst_rating=info.get("recommendationKey", ""),
        analyst_count=safe(info.get("numberOfAnalystOpinions")),
        news=all_news,
        fetch_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
    )

    return {
        "ticker": symbol,
        "company_name": company_name,
        "exchange": "NSE",
        "current_price": round(current_price, 2),
        "prev_close": round(prev_close, 2),
        "open_price": round(open_price, 2),
        "day_high": round(day_high, 2),
        "day_low": round(day_low, 2),
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "market_cap_cr": round(safe(info.get("marketCap")) / 1e7, 2),
        "pe_ratio": round(safe(info.get("trailingPE")), 2),
        "forward_pe": round(safe(info.get("forwardPE")), 2),
        "pb_ratio": round(safe(info.get("priceToBook")), 2),
        "roe": round(safe(info.get("returnOnEquity")) * 100, 2),
        "roce": round(safe(info.get("returnOnAssets")) * 100, 2),
        "debt_equity": round(safe(info.get("debtToEquity")), 2),
        "dividend_yield": round(safe(info.get("dividendYield")) * 100, 2),
        "eps": round(safe(info.get("trailingEps")), 2),
        "book_value": round(safe(info.get("bookValue")), 2),
        "revenue_cr": round(safe(info.get("totalRevenue")) / 1e7, 2),
        "profit_margin": round(safe(info.get("profitMargins")) * 100, 2),
        "operating_margin": round(safe(info.get("operatingMargins")) * 100, 2),
        "free_cashflow_cr": round(safe(info.get("freeCashflow")) / 1e7, 2),
        "sector": sector,
        "industry": industry,
        "summary": (info.get("longBusinessSummary") or "")[:600],
        "employees": info.get("fullTimeEmployees"),
        "volume": int(safe(info.get("volume"))),
        "avg_volume": int(safe(info.get("averageVolume"))),
        "beta": info.get("beta"),
        "target_price": round(safe(info.get("targetMeanPrice")), 2),
        "target_high": round(safe(info.get("targetHighPrice")), 2),
        "target_low": round(safe(info.get("targetLowPrice")), 2),
        "analyst_rating": info.get("recommendationKey", ""),
        "analyst_count": int(safe(info.get("numberOfAnalystOpinions"))),
        "analyst_data": analyst_data,
        "news_headlines": all_news,
        "quarterly_revenue": quarterly_revenue,
        "institutional_pct": round(safe(info.get("heldPercentInstitutions")) * 100, 2),
        "promoter_pct": round(safe(info.get("heldPercentInsiders")) * 100, 2),
        "rsi_14": techs["rsi_14"],
        "ema_20": techs["ema_20"],
        "ema_50": techs["ema_50"],
        "ema_200": techs["ema_200"],
        "week_52_high": techs["week_52_high"],
        "week_52_low": techs["week_52_low"],
        "raw_output": raw_display,
        "fetch_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
    }


def _format_raw_display(**kw) -> str:
    """Format live stock data as clean readable text for the UI panel."""
    news = kw.get("news", [])
    news_text = ""
    if news:
        news_text = "\n\nLATEST NEWS (Google Finance + Yahoo Finance)\n" + "─"*50
        for i, n in enumerate(news[:5], 1):
            news_text += f"\n{i}. [{n.get('date','')}] {n.get('title','')}"
            if n.get("source"):
                news_text += f" — {n['source']}"
            if n.get("summary"):
                news_text += f"\n   {n['summary'][:180]}..."

    return f"""
{'='*55}
  LIVE MARKET DATA — {kw['company_name']} ({kw['symbol']}.NS)
  Source: NSE India + Yahoo Finance + Google Finance
  Fetched: {kw['fetch_time']}
{'='*55}

PRICE INFO
----------
  Current Price : Rs {kw['current_price']:.2f}
  Previous Close: Rs {kw['prev_close']:.2f}
  Open          : Rs {kw['open_price']:.2f}
  Day High      : Rs {kw['day_high']:.2f}
  Day Low       : Rs {kw['day_low']:.2f}
  Change        : Rs {kw['change']:.2f} ({kw['change_pct']:.2f}%)
  52W High      : Rs {kw['week_high']}
  52W Low       : Rs {kw['week_low']}

FUNDAMENTALS
------------
  Market Cap    : Rs {kw['market_cap_cr']:.0f} Crores
  P/E Ratio     : {kw['pe_ratio']:.2f}
  P/B Ratio     : {kw['pb_ratio']:.2f}
  ROE           : {kw['roe']:.2f}%
  Debt/Equity   : {kw['debt_equity']:.2f}
  EPS           : Rs {kw['eps']:.2f}
  Dividend Yield: {kw['dividend_yield']:.2f}%
  Revenue       : Rs {kw['revenue_cr']:.0f} Crores
  Profit Margin : {kw['profit_margin']:.2f}%

TECHNICAL INDICATORS
---------------------
  RSI (14)      : {kw['rsi']}
  EMA 20        : Rs {kw['ema20']}
  EMA 50        : Rs {kw['ema50']}
  EMA 200       : Rs {kw['ema200']}
  Volume        : {int(kw['volume']):,}
  Avg Volume    : {int(kw['avg_volume']):,}

ANALYST CONSENSUS
-----------------
  Rating        : {kw['analyst_rating'].upper()}
  Analysts      : {int(kw['analyst_count'])}
  Price Target  : Rs {kw['target_price']:.2f}

  Sector        : {kw['sector']}
  Industry      : {kw['industry']}
{news_text}
""".strip()

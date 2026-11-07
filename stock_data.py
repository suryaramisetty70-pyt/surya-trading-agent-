"""
Live Stock Data Engine — Global A-to-Z Multi-Source Engine
Supports Company Name Auto-Resolution (e.g., typing 'tata' -> TATAMOTORS.NS, 'apple' -> AAPL)
Supports: US Stocks (AAPL, NVDA, TSLA), Indian Stocks (RELIANCE, TCS), Crypto (BTC-USD), Commodities
Sources: Yahoo Finance (fast_info + history + info) → NSE/BSE India API → Google Finance News
"""

import os
import json
import time
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timezone

# In-memory cache for sub-second speeds (60s TTL)
DATA_CACHE = {}
TOP5_CACHE = {"timestamp": 0, "data": []}
INDICES_CACHE = {"time": 0, "data": []}
HIGH_VALUE_CACHE = {"time": 0, "data": []}

def safe(val, default=0.0):
    """Safely converts to float, returning default if None, NaN or Inf."""
    try:
        if val is None:
            return default
        v = float(val)
        if math.isnan(v) or math.isinf(v):
            return default
        return v
    except (TypeError, ValueError):
        return default

def validate_bars(df: pd.DataFrame, min_bars: int = 1) -> pd.DataFrame:
    """
    Validates and cleans OHLCV price series:
    1. Checks for empty/None DataFrame
    2. Drops rows with missing, NaN, or non-finite OHLC values
    3. Enforces positive prices (> 0)
    4. Enforces high >= low consistency
    5. Deduplicates session dates
    6. Verifies minimum bar threshold
    """
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
        return pd.DataFrame()

    required = [c for c in ["Open", "High", "Low", "Close"] if c in df.columns]
    if len(required) < 4:
        return pd.DataFrame()

    clean = df.dropna(subset=["Open", "High", "Low", "Close"]).copy()

    for col in ["Open", "High", "Low", "Close"]:
        clean[col] = pd.to_numeric(clean[col], errors="coerce")

    clean = clean.dropna(subset=["Open", "High", "Low", "Close"])
    clean = clean[
        (clean["Close"] > 0) &
        (clean["Open"] > 0) &
        (clean["High"] > 0) &
        (clean["Low"] > 0) &
        (clean["High"] >= clean["Low"])
    ]

    clean = clean[~clean.index.duplicated(keep="last")]

    if len(clean) < min_bars:
        return pd.DataFrame()

    return clean

COMPANY_NAME_MAP = {
    "tata": "TATASTEEL.NS",
    "tata steel": "TATASTEEL.NS",
    "tata power": "TATAPOWER.NS",
    "tata tech": "TATATECH.NS",
    "tcs": "TCS.NS",
    "tata consultancy": "TCS.NS",
    "reliance": "RELIANCE.NS",
    "reliance industries": "RELIANCE.NS",
    "infosys": "INFY.NS",
    "wipro": "WIPRO.NS",
    "hdfc": "HDFCBANK.NS",
    "hdfc bank": "HDFCBANK.NS",
    "icici": "ICICIBANK.NS",
    "icici bank": "ICICIBANK.NS",
    "sbi": "SBIN.NS",
    "state bank": "SBIN.NS",
    "l&t": "LT.NS",
    "larsentoubro": "LT.NS",
    "adani": "ADANIENT.NS",
    "adani power": "ADANIPOWER.NS",
    "apple": "AAPL",
    "tesla": "TSLA",
    "nvidia": "NVDA",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "amazon": "AMZN",
    "meta": "META",
    "facebook": "META",
    "btc": "BTC-USD",
    "bitcoin": "BTC-USD",
    "eth": "ETH-USD",
}

NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
    "Connection": "keep-alive",
}

def _resolve_company_name_to_symbol(query: str) -> str:
    """Intelligently converts company names (e.g. 'tata', 'zomato', 'apple', 'infosys', 'palantir') to real trading symbols."""
    clean = query.strip().lower()
    if clean in COMPANY_NAME_MAP:
        return COMPANY_NAME_MAP[clean]

    # Layer 0: Check SQLite Ticker Universe (2,500+ NSE/BSE listed equities & aliases)
    try:
        from ticker_universe import resolve_and_validate_symbol
        valid, u_sym, _ = resolve_and_validate_symbol(clean)
        if valid:
            return u_sym
    except Exception:
        pass

    # Layer 1: Yahoo Ticker Search API
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={requests.utils.quote(clean)}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        r = requests.get(url, headers=headers, timeout=3).json()
        quotes = r.get("quotes", [])
        for q in quotes:
            sym = q.get("symbol")
            if sym and not sym.startswith("0P") and not "." in sym:
                return sym
            if sym and sym.endswith((".NS", ".BO")):
                return sym
        if quotes and quotes[0].get("symbol"):
            return quotes[0]["symbol"]
    except Exception:
        pass

    # Layer 2: Web Search Ticker Resolver (Resolves ANY company name worldwide in <1s)
    try:
        import re
        q_str = clean + " yahoo finance ticker symbol"
        search_url = "https://html.duckduckgo.com/html/?q=" + requests.utils.quote(q_str)
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        html = requests.get(search_url, headers=headers, timeout=3).text
        matches = re.findall(r'finance\.yahoo\.com/quote/([A-Za-z0-9\.\%-]+)', html)
        if matches:
            resolved = matches[0].upper().replace("%5E", "^")
            return resolved
    except Exception:
        pass

    return query.strip().upper()

def _get_nse_session():
    session = requests.Session()
    session.headers.update(NSE_HEADERS)
    try:
        session.get("https://www.nseindia.com", timeout=3)
    except Exception:
        pass
    return session

def _fetch_nse_data(symbol: str) -> dict:
    try:
        session = _get_nse_session()
        url = f"https://www.nseindia.com/api/quote-equity?symbol={symbol.upper()}"
        r = session.get(url, timeout=3)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return {}

def _fetch_google_finance_news(symbol: str) -> list:
    headlines = []
    try:
        url = f"https://www.google.com/finance/quote/{symbol.upper()}:NSE"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        }
        r = requests.get(url, headers=headers, timeout=3)
        if r.status_code == 200:
            text = r.text
            import re
            matches = re.findall(r'"([^"]{20,150})"(?=.*?article)', text[:40000])
            seen = set()
            for m in matches[:8]:
                if m not in seen and not m.startswith("http") and len(m) > 25:
                    headlines.append({"title": m, "source": "Google Finance", "date": ""})
                    seen.add(m)
                if len(headlines) >= 5:
                    break
    except Exception:
        pass
    return headlines

def _compute_technicals(hist: pd.DataFrame) -> dict:
    result = {"rsi_14": None, "ema_20": None, "ema_50": None, "ema_200": None,
              "week_52_high": None, "week_52_low": None}
    clean = validate_bars(hist, min_bars=5)
    if clean.empty:
        return result
    try:
        closes = clean["Close"]
        if len(closes) >= 14:
            delta = closes.diff()
            gain = delta.clip(lower=0).rolling(14).mean()
            loss = (-delta.clip(upper=0)).rolling(14).mean()
            rs = gain / (loss + 1e-8)
            rsi_val = float(100 - (100 / (1 + rs.iloc[-1])))
            if math.isfinite(rsi_val):
                result["rsi_14"] = round(rsi_val, 2)

        if len(closes) >= 20:
            val = float(closes.ewm(span=20).mean().iloc[-1])
            if math.isfinite(val):
                result["ema_20"] = round(val, 2)
        if len(closes) >= 50:
            val = float(closes.ewm(span=50).mean().iloc[-1])
            if math.isfinite(val):
                result["ema_50"] = round(val, 2)
        if len(closes) >= 200:
            val = float(closes.ewm(span=200).mean().iloc[-1])
            if math.isfinite(val):
                result["ema_200"] = round(val, 2)

        year_data = clean.tail(252)
        h_val = float(year_data["High"].max())
        l_val = float(year_data["Low"].min())
        if math.isfinite(h_val):
            result["week_52_high"] = round(h_val, 2)
        if math.isfinite(l_val):
            result["week_52_low"] = round(l_val, 2)
    except Exception:
        pass
    return result

def _extract_chart_data(hist: pd.DataFrame) -> dict:
    chart = {"dates": [], "prices": [], "volumes": [], "ema20": [], "candles": []}
    clean = validate_bars(hist, min_bars=1)
    if clean.empty:
        return chart
    try:
        df = clean.tail(90).copy()
        df["EMA20"] = df["Close"].ewm(span=20).mean()
        
        dates = [idx.strftime("%b %d") for idx in df.index]
        prices = [round(float(v), 2) for v in df["Close"] if math.isfinite(v)]
        volumes = [int(v) if math.isfinite(v) else 0 for v in df["Volume"]]
        ema20 = [round(float(v), 2) if math.isfinite(v) else None for v in df["EMA20"]]

        candle_list = []
        for i, (idx, row) in enumerate(df.iterrows()):
            o_val = safe(row.get("Open", row["Close"]))
            h_val = safe(row.get("High", row["Close"]))
            l_val = safe(row.get("Low", row["Close"]))
            c_val = safe(row["Close"])
            v_val = safe(row.get("Volume", 0))
            if all(math.isfinite(x) and x > 0 for x in [o_val, h_val, l_val, c_val]):
                candle_list.append({
                    "i": i,
                    "date": idx.strftime("%b %d"),
                    "o": round(o_val, 2),
                    "h": round(h_val, 2),
                    "l": round(l_val, 2),
                    "c": round(c_val, 2),
                    "v": int(v_val) if math.isfinite(v_val) else 0,
                })

        chart = {
            "dates": dates,
            "prices": prices,
            "volumes": volumes,
            "ema20": ema20,
            "candles": candle_list
        }
    except Exception as e:
        print(f"[Chart] Error extracting chart series: {e}")
    return chart

def get_stock_data(ticker: str, use_cache: bool = True) -> dict:
    """
    Fetch comprehensive live data for ANY stock or company name worldwide.
    Resolves company names (e.g. 'tata', 'apple', 'reliance') to real exchange symbols.
    Validates strictly against authoritative instrument master before returning.
    """
    resolved_ticker = _resolve_company_name_to_symbol(ticker)
    raw_input = resolved_ticker.upper()

    # Authoritative master validation
    from ticker_universe import resolve_and_validate_symbol
    is_valid, resolved_master, master_meta = resolve_and_validate_symbol(raw_input)
    if not is_valid:
        raise ValueError(f"UNKNOWN_SYMBOL: Symbol '{raw_input}' not found in authoritative instrument master or exchange registry.")

    now = time.time()
    if use_cache and resolved_master in DATA_CACHE:
        cached_entry = DATA_CACHE[resolved_master]
        if now - cached_entry["time"] < 60:
            return cached_entry["data"]

    info = {}
    fast_info = {}
    hist = pd.DataFrame()
    yf_news = []
    analyst_data = {}
    quarterly_revenue = []
    resolved_symbol = resolved_master

    for sym in (resolved_master,):
        try:
            stock = yf.Ticker(sym)
            
            try:
                fi = stock.fast_info
                fast_info = {
                    "last_price": safe(fi.last_price),
                    "previous_close": safe(fi.previous_close),
                    "open": safe(fi.open),
                    "day_high": safe(fi.day_high),
                    "day_low": safe(fi.day_low),
                    "market_cap": safe(fi.market_cap),
                    "year_high": safe(fi.year_high),
                    "year_low": safe(fi.year_low),
                    "currency": getattr(fi, "currency", "USD"),
                }
            except Exception:
                pass

            hist = validate_bars(stock.history(period="1y", timeout=4), min_bars=1)
            if hist.empty:
                hist = validate_bars(stock.history(period="1mo", timeout=4), min_bars=1)

            info = stock.info or {}

            # News
            try:
                raw_news = stock.news or []
                for item in raw_news[:5]:
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
            except Exception:
                pass

            # Analyst recommendations
            try:
                recs = stock.recommendations
                if recs is not None and not recs.empty:
                    latest = recs.tail(1).iloc[0]
                    analyst_data = {
                        "strong_buy": int(safe(latest.get("strongBuy"))),
                        "buy": int(safe(latest.get("buy"))),
                        "hold": int(safe(latest.get("hold"))),
                        "sell": int(safe(latest.get("sell"))),
                        "strong_sell": int(safe(latest.get("strongSell"))),
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

            if fast_info.get("last_price") or safe(info.get("currentPrice")) or safe(info.get("regularMarketPrice")) or not hist.empty:
                resolved_symbol = sym
                break

        except Exception as e:
            print(f"[Data] yfinance error for {sym}: {e}")

    # ── Secondary Source: NSE India API if Indian Stock ───────────────────────
    nse_data = _fetch_nse_data(resolved_symbol.removesuffix(".NS")) if resolved_symbol.endswith(".NS") else {}
    nse_price_info = nse_data.get("priceInfo", {})
    nse_meta = nse_data.get("metadata", {})
    nse_industry_info = nse_data.get("industryInfo", {})

    # ── News Merge ────────────────────────────────────────────────────────────
    google_news = _fetch_google_finance_news(raw_input)
    all_news = []
    seen_titles = set()
    for n in (yf_news + google_news):
        t = n.get("title", "").strip()
        if t and t not in seen_titles:
            all_news.append(n)
            seen_titles.add(t)
    all_news = all_news[:6]

    # ── Compute Technicals & Chart Series ─────────────────────────────────────
    techs = _compute_technicals(hist)
    chart_series = _extract_chart_data(hist)

    hist_last_close = 0
    if not hist.empty and "Close" in hist.columns:
        try:
            hist_last_close = safe(hist["Close"].iloc[-1])
        except Exception:
            pass

    current_price = (
        safe(nse_price_info.get("lastPrice"))
        or safe(info.get("currentPrice"))
        or safe(info.get("regularMarketPrice"))
        or safe(fast_info.get("last_price"))
        or hist_last_close
    )

    if current_price <= 0 or not math.isfinite(current_price):
        raise ValueError(f"DATA_COVERAGE_ERROR: No active market quote or trading bars available for valid instrument '{raw_input}' from configured data provider.")

    as_of = datetime.now(timezone.utc).isoformat()
    quote_id = f"Q_{resolved_master}_{int(time.time() * 1000)}"
    observed_at = None
    quote_status = "PROVIDER_QUOTE"
    if safe(nse_price_info.get("lastPrice")) > 0:
        quote_source = "NSE quote"
        observed_at = nse_meta.get("lastUpdateTime")
    elif any(safe(value) > 0 for value in (info.get("currentPrice"), info.get("regularMarketPrice"), fast_info.get("last_price"))):
        quote_source = "Yahoo Finance quote"
        exchange_time = safe(info.get("regularMarketTime"))
        if 0 < exchange_time < 4_102_444_800:
            observed_at = datetime.fromtimestamp(exchange_time, timezone.utc).isoformat()
    else:
        quote_source = "Yahoo Finance historical close"
        observed_at = hist.index[-1].date().isoformat()
        quote_status = "HISTORICAL_CLOSE"

    prev_close = (
        safe(nse_price_info.get("previousClose"))
        or safe(info.get("previousClose"))
        or safe(fast_info.get("previous_close"))
        or hist_last_close
    )

    day_high = (
        safe(nse_price_info.get("intraDayHighLow", {}).get("max"))
        or safe(info.get("dayHigh"))
        or safe(fast_info.get("day_high"))
        or current_price
    )

    day_low = (
        safe(nse_price_info.get("intraDayHighLow", {}).get("min"))
        or safe(info.get("dayLow"))
        or safe(fast_info.get("day_low"))
        or current_price
    )

    open_price = (
        safe(nse_price_info.get("open"))
        or safe(info.get("open"))
        or safe(fast_info.get("open"))
        or current_price
    )

    change = current_price - prev_close
    change_pct = (change / prev_close * 100) if prev_close else 0

    company_name = (
        nse_meta.get("companyName")
        or info.get("longName")
        or info.get("shortName")
        or raw_input
    )

    sector = (
        nse_industry_info.get("sector")
        or info.get("sector", "Global Market Asset")
    )

    industry = (
        nse_industry_info.get("industry")
        or info.get("industry", "Diversified")
    )

    currency = info.get("currency") or fast_info.get("currency") or ("INR" if resolved_symbol.endswith((".NS", ".BO")) else "USD")
    currency_symbol = "₹" if currency in ["INR", "INR."] else "$"

    market_cap_val = safe(info.get("marketCap")) or safe(fast_info.get("market_cap"))
    week_high_val = techs["week_52_high"] or safe(fast_info.get("year_high")) or current_price
    week_low_val = techs["week_52_low"] or safe(fast_info.get("year_low")) or current_price

    raw_display = _format_raw_display(
        company_name=company_name,
        symbol=raw_input,
        current_price=current_price,
        prev_close=prev_close,
        open_price=open_price,
        day_high=day_high,
        day_low=day_low,
        change=change,
        change_pct=change_pct,
        market_cap_cr=market_cap_val / 1e7 if market_cap_val else 0,
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
        week_high=week_high_val,
        week_low=week_low_val,
        target_price=safe(info.get("targetMeanPrice")),
        analyst_rating=info.get("recommendationKey", "N/A"),
        analyst_count=safe(info.get("numberOfAnalystOpinions")),
        currency_symbol=currency_symbol,
        news=all_news,
        fetch_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
    )

    data = {
        "ticker": raw_input,
        "company_name": company_name,
        "exchange": "NSE" if resolved_symbol.endswith(".NS") else ("BSE" if resolved_symbol.endswith(".BO") else "GLOBAL"),
        "currency_symbol": currency_symbol,
        "current_price": round(current_price, 2),
        "prev_close": round(prev_close, 2),
        "open_price": round(open_price, 2),
        "day_high": round(day_high, 2),
        "day_low": round(day_low, 2),
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "market_cap_cr": round(market_cap_val / 1e7, 2) if market_cap_val else 0,
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
        "analyst_rating": info.get("recommendationKey", "N/A"),
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
        "week_52_high": week_high_val,
        "week_52_low": week_low_val,
        "chart_series": chart_series,
        "raw_output": raw_display,
        "fetch_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
        "quote_id": quote_id,
        "observed_at": observed_at,
        "as_of": as_of,
        "source": quote_source,
        "status": quote_status,
    }

    DATA_CACHE[resolved_master] = {"time": time.time(), "data": data}
    return data

def _fetch_single_top_quote(ticker: str, name: str) -> dict:
    try:
        stock = yf.Ticker(f"{ticker}.NS")
        fi = stock.fast_info
        last_p = float(fi.last_price or 0)
        prev_p = float(fi.previous_close or last_p or 1)
        chg = last_p - prev_p
        chg_pct = (chg / prev_p * 100) if prev_p else 0
        day_h = float(fi.day_high or last_p)
        day_l = float(fi.day_low or last_p)

        return {
            "ticker": ticker,
            "name": name,
            "price": round(last_p, 2),
            "change": round(chg, 2),
            "change_pct": round(chg_pct, 2),
            "day_high": round(day_h, 2),
            "day_low": round(day_l, 2),
            "sector": "Indian Equities",
        }
    except Exception:
        d = get_stock_data(ticker)
        return {
            "ticker": ticker,
            "name": d.get("company_name", name),
            "price": d.get("current_price", 0),
            "change": d.get("change", 0),
            "change_pct": d.get("change_pct", 0),
            "day_high": d.get("day_high", 0),
            "day_low": d.get("day_low", 0),
            "sector": d.get("sector", "Indian Equities"),
        }

def get_top_5_stocks() -> list:
    global TOP5_CACHE
    now = time.time()
    if now - TOP5_CACHE["timestamp"] < 60 and TOP5_CACHE["data"]:
        return TOP5_CACHE["data"]

    top_tickers = [
        ("RELIANCE", "Reliance Industries"),
        ("TCS", "Tata Consultancy Services"),
        ("HDFCBANK", "HDFC Bank"),
        ("INFY", "Infosys"),
        ("ICICIBANK", "ICICI Bank"),
    ]

    results = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(_fetch_single_top_quote, ticker, name) for ticker, name in top_tickers]
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                print(f"[Top5] Error fetching stock quote: {e}")

    order_map = {t[0]: i for i, t in enumerate(top_tickers)}
    results.sort(key=lambda x: order_map.get(x["ticker"], 99))

    TOP5_CACHE = {"timestamp": now, "data": results}
    return results

def _format_raw_display(**kw) -> str:
    news = kw.get("news", [])
    news_text = ""
    if news:
        news_text = "\n\nLATEST NEWS & CATALYSTS\n" + "─"*50
        for i, n in enumerate(news[:5], 1):
            news_text += f"\n{i}. [{n.get('date','')}] {n.get('title','')}"
            if n.get("source"):
                news_text += f" — {n['source']}"
            if n.get("summary"):
                news_text += f"\n   {n['summary'][:180]}..."

    curr = kw.get("currency_symbol", "₹")

    return f"""
{'='*55}
  LIVE MARKET DATA — {kw['company_name']} ({kw['symbol']})
  Source: Global Market Exchange + Yahoo Finance + Google Finance
  Fetched: {kw['fetch_time']}
{'='*55}

PRICE INFO
----------
  Current Price : {curr} {kw['current_price']:.2f}
  Previous Close: {curr} {kw['prev_close']:.2f}
  Open          : {curr} {kw['open_price']:.2f}
  Day High      : {curr} {kw['day_high']:.2f}
  Day Low       : {curr} {kw['day_low']:.2f}
  Change        : {curr} {kw['change']:.2f} ({kw['change_pct']:.2f}%)
  52W High      : {curr} {kw['week_high']}
  52W Low       : {curr} {kw['week_low']}

FUNDAMENTALS
------------
  Market Cap    : {curr} {kw['market_cap_cr']:.0f} Cr / Val
  P/E Ratio     : {kw['pe_ratio']:.2f}
  P/B Ratio     : {kw['pb_ratio']:.2f}
  ROE           : {kw['roe']:.2f}%
  Debt/Equity   : {kw['debt_equity']:.2f}
  EPS           : {curr} {kw['eps']:.2f}
  Dividend Yield: {kw['dividend_yield']:.2f}%
  Revenue       : {curr} {kw['revenue_cr']:.0f} Cr
  Profit Margin : {kw['profit_margin']:.2f}%

TECHNICAL INDICATORS
---------------------
  RSI (14)      : {kw['rsi']}
  EMA 20        : {curr} {kw['ema20']}
  EMA 50        : {curr} {kw['ema50']}
  EMA 200       : {curr} {kw['ema200']}
  Volume        : {int(kw['volume']):,}
  Avg Volume    : {int(kw['avg_volume']):,}

ANALYST CONSENSUS
-----------------
  Rating        : {str(kw['analyst_rating']).upper()}
  Analysts      : {int(kw['analyst_count'])}
  Price Target  : {curr} {kw['target_price']:.2f}{news_text}
"""

def get_highest_share_price_stocks() -> list:
    """Fetches real live quotes for India's highest per-share price companies (MRF, Page Industries, Shree Cement, etc). Cached for 60s."""
    now = time.time()
    if HIGH_VALUE_CACHE["data"] and (now - HIGH_VALUE_CACHE["time"] < 60):
        return HIGH_VALUE_CACHE["data"]

    high_value_symbols = [
        {"symbol": "MRF.NS", "name": "MRF Ltd.", "category": "TIRES & RUBBER"},
        {"symbol": "PAGEIND.NS", "name": "Page Industries Ltd.", "category": "APPAREL"},
        {"symbol": "SHREECEM.NS", "name": "Shree Cement Ltd.", "category": "CEMENT"},
        {"symbol": "HONAUT.NS", "name": "Honeywell Automation India", "category": "AUTOMATION"},
        {"symbol": "3MINDIA.NS", "name": "3M India Ltd.", "category": "DIVERSIFIED"},
        {"symbol": "BOSCHLTD.NS", "name": "Bosch Ltd.", "category": "AUTO COMPONENTS"},
        {"symbol": "NESTLEIND.NS", "name": "Nestle India Ltd.", "category": "FMCG"},
        {"symbol": "ABBOTINDIA.NS", "name": "Abbott India Ltd.", "category": "PHARMA"},
        {"symbol": "TATAELXSI.NS", "name": "Tata Elxsi Ltd.", "category": "IT DESIGN"}
    ]

    def _fetch_one(item):
        try:
            st = yf.Ticker(item["symbol"])
            fi = st.fast_info
            price = safe(fi.last_price)
            prev = safe(fi.previous_close)
            change = price - prev if (price and prev) else 0
            change_pct = (change / prev * 100) if prev else 0
            if price > 0:
                return {
                    "symbol": item["symbol"].replace(".NS", ""),
                    "name": item["name"],
                    "category": item["category"],
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "currency": "₹"
                }
        except Exception:
            pass
        return None

    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = [ex.submit(_fetch_one, it) for it in high_value_symbols]
        for f in as_completed(futures):
            res = f.result()
            if res:
                results.append(res)

    results = sorted(results, key=lambda x: x["price"], reverse=True)
    if results:
        HIGH_VALUE_CACHE["data"] = results
        HIGH_VALUE_CACHE["time"] = now
    return results if results else HIGH_VALUE_CACHE.get("data", [])


def get_all_india_indices() -> list:
    """Fetches real-time quotes for all major Indian market indices in parallel. Cached for 45s."""
    now = time.time()
    if INDICES_CACHE["data"] and (now - INDICES_CACHE["time"] < 180):
        return INDICES_CACHE["data"]

    indices = [
        {"symbol": "^NSEI", "name": "NIFTY 50", "group": "BENCHMARK"},
        {"symbol": "^BSESN", "name": "SENSEX", "group": "BENCHMARK"},
        {"symbol": "^NSEBANK", "name": "BANK NIFTY", "group": "SECTORAL"},
        {"symbol": "^CRSLDX", "name": "MIDCAP 100", "group": "BROAD"},
        {"symbol": "^CNXIT", "name": "NIFTY IT", "group": "SECTORAL"},
        {"symbol": "^CNXAUTO", "name": "NIFTY AUTO", "group": "SECTORAL"},
        {"symbol": "^CNXPHARMA", "name": "NIFTY PHARMA", "group": "SECTORAL"},
        {"symbol": "^CNXFMCG", "name": "NIFTY FMCG", "group": "SECTORAL"},
        {"symbol": "^CNXMETAL", "name": "NIFTY METAL", "group": "SECTORAL"},
        {"symbol": "^CNXREALTY", "name": "NIFTY REALTY", "group": "SECTORAL"},
        {"symbol": "^CNXENERGY", "name": "NIFTY ENERGY", "group": "SECTORAL"},
        {"symbol": "^INDIAVIX", "name": "INDIA VIX", "group": "VOLATILITY"},
        {"symbol": "GC=F", "name": "Gold futures (COMEX)", "group": "COMMODITY"},
        {"symbol": "SI=F", "name": "Silver futures (COMEX)", "group": "COMMODITY"},
        {"symbol": "CL=F", "name": "CRUDE OIL", "group": "COMMODITY"},
        {"symbol": "USDINR=X", "name": "USD / INR", "group": "CURRENCY"}
    ]

    def _fetch_idx(item):
        try:
            st = yf.Ticker(item["symbol"])
            fi = st.fast_info
            price = safe(fi.last_price)
            prev = safe(fi.previous_close)
            change = price - prev if (price and prev) else 0
            change_pct = (change / prev * 100) if prev else 0
            if price > 0:
                return {
                    "symbol": item["name"],
                    "group": item["group"],
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2)
                }
        except Exception:
            pass
        return None

    results = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = {ex.submit(_fetch_idx, it): it for it in indices}
        for f in as_completed(futures):
            res = f.result()
            if res:
                results.append(res)

    # Sort results in predictable original order
    order_map = {it["name"]: idx for idx, it in enumerate(indices)}
    results.sort(key=lambda x: order_map.get(x["symbol"], 999))

    if results:
        INDICES_CACHE["data"] = results
        INDICES_CACHE["time"] = now
    return results if results else INDICES_CACHE.get("data", [])


def get_multi_asset_galaxy_nodes() -> list:
    """Fetches multi-asset commodity and stock nodes with real market colors in parallel."""
    nodes = [
        {"symbol": "GOLD", "name": "Gold futures (COMEX)", "asset_class": "Precious Metals", "color": "#f59e0b", "ticker": "GC=F"},
        {"symbol": "SILVER", "name": "Silver futures (COMEX)", "asset_class": "Precious Metals", "color": "#e2e8f0", "ticker": "SI=F"},
        {"symbol": "COPPER", "name": "High Grade Copper", "asset_class": "Base Metals", "color": "#d97706", "ticker": "HG=F"},
        {"symbol": "TATASTEEL", "name": "Tata Steel Ltd.", "asset_class": "Metals & Mining", "color": "#f97316", "ticker": "TATASTEEL.NS"},
        {"symbol": "HINDALCO", "name": "Hindalco Industries", "asset_class": "Metals & Mining", "color": "#ea580c", "ticker": "HINDALCO.NS"},
        {"symbol": "CRUDEOIL", "name": "WTI Crude Oil", "asset_class": "Energy", "color": "#ef4444", "ticker": "CL=F"},
        {"symbol": "RELIANCE", "name": "Reliance Industries", "asset_class": "Energy & Retail", "color": "#dc2626", "ticker": "RELIANCE.NS"},
        {"symbol": "DLF", "name": "DLF Ltd.", "asset_class": "Real Estate", "color": "#ec4899", "ticker": "DLF.NS"},
        {"symbol": "GODREJPROP", "name": "Godrej Properties", "asset_class": "Real Estate", "color": "#f43f5e", "ticker": "GODREJPROP.NS"},
        {"symbol": "TCS", "name": "Tata Consultancy Services", "asset_class": "Technology", "color": "#06b6d4", "ticker": "TCS.NS"},
        {"symbol": "INFY", "name": "Infosys Ltd.", "asset_class": "Technology", "color": "#0ea5e9", "ticker": "INFY.NS"},
        {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd.", "asset_class": "Financials", "color": "#3b82f6", "ticker": "HDFCBANK.NS"},
        {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd.", "asset_class": "Financials", "color": "#2563eb", "ticker": "ICICIBANK.NS"}
    ]

    def _fetch_node(nd):
        try:
            st = yf.Ticker(nd["ticker"])
            fi = st.fast_info
            p = safe(fi.last_price)
            prev = safe(fi.previous_close)
            chg = p - prev if (p and prev) else 0
            chg_pct = (chg / prev * 100) if prev else 0
            if p > 0:
                return {
                    "symbol": nd["symbol"],
                    "name": nd["name"],
                    "asset_class": nd["asset_class"],
                    "color": nd["color"],
                    "price": round(p, 2),
                    "change_pct": round(chg_pct, 2)
                }
        except Exception:
            pass
        return None

    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = [ex.submit(_fetch_node, nd) for nd in nodes]
        for f in as_completed(futures):
            res = f.result()
            if res:
                results.append(res)
    return results


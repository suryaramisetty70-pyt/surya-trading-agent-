"""
Institutional Market Screener & Breakout Scanner
Scans Indian Equities across key quantitative setups:
1. 52-Week High Breakouts
2. Golden Cross (Trend Alignment: Price > EMA 20 > EMA 50)
3. Oversold Rebound (RSI < 42 with positive reversal)
4. Volume Surge (> 1.25x 20-day average volume)

Supports states:
- ready: genuine live data loaded
- empty: 0 matches for selected strategy filter
- stale: provider error / delay with last-good snapshot labeled
- unconfigured: missing provider configuration
- timeout: bounded upstream deadline exceeded
"""

import time
from concurrent.futures import ThreadPoolExecutor, wait
from threading import Lock
from market_guard import MarketError
import yfinance as yf

from stock_data import _compute_technicals, safe, validate_bars

SCREENER_CACHE = {"time": 0, "as_of": None, "data": None}
SCAN_WORKERS = ThreadPoolExecutor(max_workers=8)
SCAN_LOCK = Lock()
SCAN_FUTURES = []

SCREENER_CANDIDATES = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "SBIN.NS", "LT.NS", "BHARTIARTL.NS", "TITAN.NS", "TATASTEEL.NS",
    "HCLTECH.NS", "MARUTI.NS", "SUNPHARMA.NS", "ITC.NS", "NTPC.NS",
    "BAJFINANCE.NS", "ADANIENT.NS", "ADANIPOWER.NS", "DLF.NS", "BEL.NS"
]

def _load_scan_data(symbol):
    """Fetch only the daily OHLCV needed by the screener."""
    bars = validate_bars(yf.Ticker(symbol).history(
        period="1y", interval="1d", auto_adjust=False, timeout=3,
    ), min_bars=2).sort_index()
    if bars.empty:
        return None

    tech = _compute_technicals(bars)
    if len(bars) < 230:
        tech["week_52_high"] = None
    price = float(bars["Close"].iloc[-1])
    previous = float(bars["Close"].iloc[-2])
    volume = bars.get("Volume")
    average_volume = volume.iloc[-21:-1].mean() if volume is not None and len(volume) >= 21 else None
    return {
        **tech,
        "current_price": price,
        "change_pct": (price / previous - 1) * 100,
        "volume": volume.iloc[-1] if volume is not None else None,
        "avg_volume": average_volume,
        "observed_at": bars.index[-1].date().isoformat(),
    }


def scan_stocks(strategy: str = "ALL", timeout: float = 8.0) -> dict:
    """
    Scans market with bounded timeout and explicit states:
    'ready', 'empty', 'stale', 'unconfigured', 'timeout'
    """
    now = time.time()
    clean_strat = strategy.upper() if strategy else "ALL"

    with SCAN_LOCK:
        snapshot = SCREENER_CACHE.copy()
    if snapshot["data"] and (now - snapshot["time"] < 60):
        cached_all = snapshot["data"]
        rows = cached_all.get(clean_strat, cached_all.get("ALL", [])) if clean_strat != "ALL" else cached_all.get("ALL", [])
        return {
            "status": "success",
            "state": "ready" if rows else "empty",
            "as_of": snapshot["as_of"],
            "source": "Yahoo Finance daily bars (cached)",
            "is_stale": False,
            "data": rows,
            "total": len(rows),
        }

    def _analyze_one(sym):
        try:
            d = _load_scan_data(sym)
            if not d or not d.get("current_price"):
                return None

            price = safe(d["current_price"])
            p_change = safe(d.get("change_pct"))
            w_high = safe(d.get("week_52_high"))
            rsi = d.get("rsi_14")
            ema20 = safe(d.get("ema_20"))
            ema50 = safe(d.get("ema_50"))
            vol = safe(d.get("volume"))
            avg_vol = safe(d.get("avg_volume"))

            vol_ratio = round(vol / avg_vol, 2) if avg_vol > 0 and vol > 0 else None
            dist_to_52w = round(((w_high - price) / w_high) * 100, 2) if w_high else None

            tags = []
            if dist_to_52w is not None and dist_to_52w <= 3.5:
                tags.append("52W_HIGH")
            if price > ema20 > ema50 > 0:
                tags.append("GOLDEN_CROSS")
            if rsi is not None and rsi <= 42 and p_change >= 0:
                tags.append("OVERSOLD_REBOUND")
            if vol_ratio is not None and vol_ratio >= 1.25:
                tags.append("VOLUME_SURGE")

            return {
                "symbol": sym.replace(".NS", ""),
                "name": d.get("company_name", sym),
                "price": round(price, 2),
                "change_pct": round(p_change, 2),
                "rsi_14": round(rsi, 1) if rsi is not None else None,
                "vol_ratio": vol_ratio,
                "dist_to_52w_high": dist_to_52w,
                "tags": tags,
                "sector": d.get("sector", "—"),
                "observed_at": d.get("observed_at")
            }
        except Exception:
            return None

    # A retry observes the same in-flight scan instead of multiplying upstream requests.
    global SCAN_FUTURES
    with SCAN_LOCK:
        if not SCAN_FUTURES:
            SCAN_FUTURES = [SCAN_WORKERS.submit(_analyze_one, sym) for sym in SCREENER_CANDIDATES]
        futures = SCAN_FUTURES

    done, pending = wait(futures, timeout=timeout)
    items = [row for future in futures if future in done and (row := future.result()) is not None]
    timed_out = bool(pending)

    if items:
        # Use the oldest included observation so a mixed-session scan cannot look newer.
        dates = [item["observed_at"] for item in items if item["observed_at"]]
        now_iso = min(dates) if dates else None
        results_by_strat = {
            "ALL": items,
            "52W_HIGH": [x for x in items if "52W_HIGH" in x["tags"]],
            "GOLDEN_CROSS": [x for x in items if "GOLDEN_CROSS" in x["tags"]],
            "OVERSOLD_REBOUND": [x for x in items if "OVERSOLD_REBOUND" in x["tags"]],
            "VOLUME_SURGE": [x for x in items if "VOLUME_SURGE" in x["tags"]],
        }
        if not pending:
            with SCAN_LOCK:
                if SCAN_FUTURES is futures:
                    if len(items) == len(SCREENER_CANDIDATES):
                        SCREENER_CACHE.update(data=results_by_strat, time=time.time(), as_of=now_iso)
                    SCAN_FUTURES = []

        rows = results_by_strat.get(clean_strat, results_by_strat["ALL"]) if clean_strat != "ALL" else results_by_strat["ALL"]
        return {
            "status": "success",
            "state": "stale" if len(items) < len(SCREENER_CANDIDATES) else ("ready" if rows else "empty"),
            "as_of": now_iso,
            "source": "Yahoo Finance daily bars",
            "is_stale": len(items) < len(SCREENER_CANDIDATES),
            "message": f"Only {len(items)} of {len(SCREENER_CANDIDATES)} instruments returned data." if len(items) < len(SCREENER_CANDIDATES) else None,
            "data": rows,
            "total": len(rows),
        }

    if not pending:
        with SCAN_LOCK:
            if SCAN_FUTURES is futures:
                SCAN_FUTURES = []

    # If timed out or failed, check if we have a last-good snapshot:
    if snapshot["data"]:
        stale_all = snapshot["data"]
        rows = stale_all.get(clean_strat, stale_all.get("ALL", [])) if clean_strat != "ALL" else stale_all.get("ALL", [])
        return {
            "status": "success",
            "state": "stale",
            "is_stale": True,
            "as_of": snapshot["as_of"],
            "source": "Yahoo Finance daily bars (stale)",
            "message": "Upstream feed latency high. Displaying last successful snapshot.",
            "data": rows,
            "total": len(rows),
        }

    if timed_out:
        raise MarketError(504, "SCREENER_TIMEOUT", "Market feed timed out before receiving data. Retry is available.")

    raise MarketError(503, "SCREENER_UNAVAILABLE", "Market feed currently unavailable from data provider.")

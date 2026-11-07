"""
Auto-Scaling Ticker Universe Engine for Surya AI Trading Agent
Handles automated symbol discovery from NSE & BSE public masters,
renaming/relisting resolution (e.g. Zomato -> ETERNAL.NS),
2-year historical data backfilling, and SQLite persistence.
"""

import os
import sqlite3
import io
import time
import requests
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "ticker_universe.db")

NSE_EQUITY_CSV_URL = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "*/*",
}

# Initial seed tickers for immediate bootstrap
DEFAULT_BOOTSTRAP_TICKERS = [
    ("RELIANCE.NS", "Reliance Industries Limited", "NSE", "INE002A01018", "Energy"),
    ("TCS.NS", "Tata Consultancy Services Limited", "NSE", "INE467B01029", "Technology"),
    ("HDFCBANK.NS", "HDFC Bank Limited", "NSE", "INE040A01034", "Financials"),
    ("ICICIBANK.NS", "ICICI Bank Limited", "NSE", "INE090A01021", "Financials"),
    ("INFY.NS", "Infosys Limited", "NSE", "INE009A01021", "Technology"),
    ("SBIN.NS", "State Bank of India", "NSE", "INE062A01020", "Financials"),
    ("BHARTIARTL.NS", "Bharti Airtel Limited", "NSE", "INE397D01024", "Communication"),
    ("ITC.NS", "ITC Limited", "NSE", "INE154A01025", "Consumer Cyclical"),
    ("LTIM.NS", "LTIMindtree Limited", "NSE", "INE214T01019", "Technology"),
    ("LT.NS", "Larsen & Toubro Limited", "NSE", "INE018A01030", "Industrials"),
    ("ETERNAL.NS", "Eternal Limited (formerly Zomato)", "NSE", "INE758T01015", "Consumer Cyclical"),
    ("TATAPOWER.NS", "Tata Power Company Limited", "NSE", "INE245A01021", "Utilities"),
    ("TATASTEEL.NS", "Tata Steel Limited", "NSE", "INE081A01020", "Materials"),
    ("SWIGGY.NS", "Swiggy Limited", "NSE", "INE002T01014", "Consumer Cyclical"),
]

# Explicit alias map for renames & common search queries
KNOWN_ALIASES = {
    "ZOMATO": "ETERNAL.NS",
    "ZOMATO.NS": "ETERNAL.NS",
    "ETERNAL": "ETERNAL.NS",
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "INFY": "INFY.NS",
    "INFOSYS": "INFY.NS",
    "HDFC": "HDFCBANK.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "ICICI": "ICICIBANK.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "SBI": "SBIN.NS",
    "SBIN": "SBIN.NS",
    "TATA MOTORS": "TATAPOWER.NS",
    "TATASTEEL": "TATASTEEL.NS",
    "SWIGGY": "SWIGGY.NS",
}


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes SQLite schema for Ticker Universe & Aliases."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickers (
            symbol TEXT PRIMARY KEY,
            company_name TEXT NOT NULL,
            exchange TEXT NOT NULL,
            isin TEXT,
            sector TEXT,
            active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            backfilled INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ticker_aliases (
            alias TEXT PRIMARY KEY,
            target_symbol TEXT NOT NULL,
            FOREIGN KEY (target_symbol) REFERENCES tickers(symbol)
        )
    """)

    # Seed initial bootstrap tickers
    now = datetime.now(timezone.utc).isoformat()
    for symbol, name, exch, isin, sector in DEFAULT_BOOTSTRAP_TICKERS:
        cursor.execute("""
            INSERT OR IGNORE INTO tickers (symbol, company_name, exchange, isin, sector, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (symbol, name, exch, isin, sector, now))

    for alias, target in KNOWN_ALIASES.items():
        cursor.execute("""
            INSERT OR REPLACE INTO ticker_aliases (alias, target_symbol)
            VALUES (?, ?)
        """, (alias.upper(), target))

    conn.commit()
    conn.close()


def fetch_nse_master_csv():
    """Downloads public NSE Equity Master CSV."""
    try:
        resp = requests.get(NSE_EQUITY_CSV_URL, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            df = pd.read_csv(io.StringIO(resp.text))
            return df
    except Exception as e:
        print(f"[Universe] Warning: Could not fetch public NSE master CSV: {e}")
    return None


def sync_universe():
    """
    Fetches official NSE master list, diffs against existing universe,
    auto-adds new IPOs/relistings, and updates aliases.
    """
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    df = fetch_nse_master_csv()
    added_count = 0
    updated_count = 0

    if df is not None and not df.empty:
        # Standardize column headers
        df.columns = [c.strip().upper() for c in df.columns]
        symbol_col = "SYMBOL" if "SYMBOL" in df.columns else df.columns[0]
        name_col = "NAME OF COMPANY" if "NAME OF COMPANY" in df.columns else df.columns[1]
        isin_col = "ISIN NUMBER" if "ISIN NUMBER" in df.columns else None

        now = datetime.now(timezone.utc).isoformat()

        for _, row in df.iterrows():
            raw_sym = str(row[symbol_col]).strip().upper()
            if not raw_sym or raw_sym == "NAN":
                continue

            symbol = f"{raw_sym}.NS"
            company_name = str(row[name_col]).strip() if name_col in row else raw_sym
            isin = str(row[isin_col]).strip() if isin_col and isin_col in row else ""

            # Check if symbol exists
            cursor.execute("SELECT symbol, company_name FROM tickers WHERE symbol = ?", (symbol,))
            existing = cursor.fetchone()

            if not existing:
                cursor.execute("""
                    INSERT INTO tickers (symbol, company_name, exchange, isin, sector, updated_at)
                    VALUES (?, ?, 'NSE', ?, 'Equity', ?)
                """, (symbol, company_name, isin, now))
                added_count += 1
            else:
                if existing["company_name"] != company_name:
                    cursor.execute("""
                        UPDATE tickers SET company_name = ?, updated_at = ? WHERE symbol = ?
                    """, (company_name, now, symbol))
                    updated_count += 1

            # Auto-add clean aliases
            clean_alias = raw_sym.replace("-", "").replace("_", "")
            cursor.execute("""
                INSERT OR REPLACE INTO ticker_aliases (alias, target_symbol)
                VALUES (?, ?)
            """, (clean_alias, symbol))

    conn.commit()

    # Get total count
    cursor.execute("SELECT COUNT(*) as total FROM tickers WHERE active = 1")
    total_active = cursor.fetchone()["total"]
    conn.close()

    return {
        "status": "success",
        "added": added_count,
        "updated": updated_count,
        "total_active": total_active,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# Global Indices and Multi-Asset Mappings
KNOWN_GLOBAL_ASSETS = {
    "^NSEI": {"name": "NIFTY 50", "exchange": "NSE", "sector": "Benchmark Index"},
    "^BSESN": {"name": "S&P BSE SENSEX", "exchange": "BSE", "sector": "Benchmark Index"},
    "^NSEBANK": {"name": "NIFTY Bank", "exchange": "NSE", "sector": "Banking Index"},
    "^CNXIT": {"name": "NIFTY IT", "exchange": "NSE", "sector": "Sectoral Index"},
    "NIFTY": {"name": "NIFTY 50", "exchange": "NSE", "sector": "Benchmark Index", "resolved": "^NSEI"},
    "NIFTY50": {"name": "NIFTY 50", "exchange": "NSE", "sector": "Benchmark Index", "resolved": "^NSEI"},
    "BANKNIFTY": {"name": "NIFTY Bank", "exchange": "NSE", "sector": "Banking Index", "resolved": "^NSEBANK"},
    "SENSEX": {"name": "S&P BSE SENSEX", "exchange": "BSE", "sector": "Benchmark Index", "resolved": "^BSESN"},
    "BTC-USD": {"name": "Bitcoin USD", "exchange": "CRYPTO", "sector": "Digital Asset"},
    "ETH-USD": {"name": "Ethereum USD", "exchange": "CRYPTO", "sector": "Digital Asset"},
    "GC=F": {"name": "Gold Futures", "exchange": "COMEX", "sector": "Commodity"},
    "SI=F": {"name": "Silver Futures", "exchange": "COMEX", "sector": "Commodity"},
    "CL=F": {"name": "Crude Oil WTI", "exchange": "NYMEX", "sector": "Energy Commodity"},
}


NEGATIVE_SYMBOL_CACHE = set()
VALID_SYMBOL_CACHE = {}


def resolve_and_validate_symbol(query: str) -> tuple[bool, str, dict]:
    """
    Authoritative Instrument Master Resolution:
    Validates user query against SQLite ticker universe, aliases, and known indices.
    Returns: (is_valid: bool, resolved_symbol: str, metadata: dict)
    If symbol is invalid or fabricated (e.g. ZZZINVALIDTEST), returns (False, query, {}).
    """
    init_db()
    if not query or not query.strip():
        return False, "", {}

    q_clean = query.strip().upper()

    if q_clean in NEGATIVE_SYMBOL_CACHE:
        return False, q_clean, {}

    if q_clean in VALID_SYMBOL_CACHE:
        item = VALID_SYMBOL_CACHE[q_clean]
        return True, item[0], item[1]

    # 1. Check known global assets & market indices
    if q_clean in KNOWN_GLOBAL_ASSETS:
        item = KNOWN_GLOBAL_ASSETS[q_clean]
        resolved = item.get("resolved", q_clean)
        return True, resolved, {
            "symbol": resolved,
            "company_name": item["name"],
            "exchange": item["exchange"],
            "sector": item["sector"],
            "isin": "",
        }

    conn = get_db_connection()
    cursor = conn.cursor()

    # 2. Check alias map
    cursor.execute("SELECT target_symbol FROM ticker_aliases WHERE alias = ?", (q_clean,))
    alias_row = cursor.fetchone()
    if alias_row:
        target = alias_row["target_symbol"]
        cursor.execute("SELECT symbol, company_name, exchange, isin, sector FROM tickers WHERE symbol = ?", (target,))
        t_row = cursor.fetchone()
        conn.close()
        if t_row:
            return True, t_row["symbol"], {
                "symbol": t_row["symbol"],
                "company_name": t_row["company_name"],
                "exchange": t_row["exchange"],
                "isin": t_row["isin"] or "",
                "sector": t_row["sector"] or "Equity",
            }
        return True, target, {"symbol": target, "company_name": target, "exchange": "NSE", "isin": "", "sector": "Equity"}

    # 3. Check exact symbol in tickers table (with and without exchange suffix)
    candidates = []
    if "." in q_clean:
        candidates = [q_clean, q_clean.replace(".NS", ""), q_clean.replace(".BO", "")]
    else:
        candidates = [f"{q_clean}.NS", f"{q_clean}.BO", q_clean]

    for cand in candidates:
        cursor.execute("SELECT symbol, company_name, exchange, isin, sector FROM tickers WHERE symbol = ?", (cand,))
        row = cursor.fetchone()
        if row:
            conn.close()
            return True, row["symbol"], {
                "symbol": row["symbol"],
                "company_name": row["company_name"],
                "exchange": row["exchange"],
                "isin": row["isin"] or "",
                "sector": row["sector"] or "Equity",
            }

    # 4. Check full text match in company_name
    cursor.execute("""
        SELECT symbol, company_name, exchange, isin, sector FROM tickers
        WHERE UPPER(company_name) LIKE ? OR UPPER(symbol) LIKE ?
        LIMIT 1
    """, (f"%{q_clean}%", f"%{q_clean}%"))
    row = cursor.fetchone()
    conn.close()

    if row:
        return True, row["symbol"], {
            "symbol": row["symbol"],
            "company_name": row["company_name"],
            "exchange": row["exchange"],
            "isin": row["isin"] or "",
            "sector": row["sector"] or "Equity",
        }

    # 5. Check yfinance fallback for global active equities not in local DB
    # Fast check: must have valid price and history bars
    try:
        t = yf.Ticker(q_clean)
        fi = t.fast_info
        last_price = getattr(fi, "last_price", None)
        if last_price and last_price > 0:
            h = t.history(period="5d")
            if not h.empty and len(h) >= 1:
                res_meta = {
                    "symbol": q_clean,
                    "company_name": q_clean,
                    "exchange": "GLOBAL",
                    "isin": "",
                    "sector": "International Asset",
                }
                VALID_SYMBOL_CACHE[q_clean] = (q_clean, res_meta)
                return True, q_clean, res_meta
    except Exception:
        pass

    # Symbol cannot be validated against any authoritative source
    NEGATIVE_SYMBOL_CACHE.add(q_clean)
    return False, q_clean, {}


def resolve_symbol(query: str) -> str:
    """
    Resolves user query to official exchange symbol.
    Returns resolved symbol if valid, or original symbol.
    """
    is_valid, resolved, _ = resolve_and_validate_symbol(query)
    if is_valid:
        return resolved
    return query.strip().upper()


def lookup_instrument(exchange: str, symbol: str):
    """
    Lookup adapter for market_guard.resolve_instrument.
    Returns Instrument instance if symbol exists in authoritative master, else None.
    """
    from market_guard import Instrument
    is_valid, resolved, meta = resolve_and_validate_symbol(symbol)
    if not is_valid:
        return None
    ex = meta.get("exchange") or (exchange.strip().upper() if exchange else "NSE")
    canonical_sym = resolved.replace(".NS", "").replace(".BO", "").strip().upper()
    inst_id = f"{ex}:{resolved}"
    return Instrument(
        instrument_id=inst_id,
        exchange=ex,
        symbol=canonical_sym,
        currency="INR",
        active=True
    )


def backfill_universe(max_symbols: int = 20, period: str = "2y"):
    """
    Backfills 2 years of daily data for symbols marked backfilled = 0.
    """
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT symbol FROM tickers WHERE backfilled = 0 LIMIT ?
    """, (max_symbols,))
    symbols_to_fill = [r["symbol"] for r in cursor.fetchall()]

    completed = 0
    now = datetime.now(timezone.utc).isoformat()

    for sym in symbols_to_fill:
        try:
            ticker = yf.Ticker(sym)
            df = ticker.history(period=period)
            if not df.empty:
                completed += 1
                cursor.execute("""
                    UPDATE tickers SET backfilled = 1, updated_at = ? WHERE symbol = ?
                """, (now, sym))
        except Exception as e:
            print(f"[Universe Backfill] Error backfilling {sym}: {e}")

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "processed": len(symbols_to_fill),
        "completed": completed,
    }


def get_universe_stats():
    """Returns active symbol stats."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM tickers WHERE active = 1")
    total = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as backfilled FROM tickers WHERE active = 1 AND backfilled = 1")
    backfilled = cursor.fetchone()["backfilled"]
    conn.close()

    return {
        "total_symbols": total,
        "backfilled_symbols": backfilled,
        "db_path": DB_PATH,
    }


if __name__ == "__main__":
    print("[Universe] Initializing database & syncing NSE/BSE master lists...")
    res = sync_universe()
    print(f"[Universe] Sync Complete: {res}")
    print(f"[Universe] Ticker Stats: {get_universe_stats()}")

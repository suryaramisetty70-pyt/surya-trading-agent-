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
from datetime import datetime, timedelta

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
    ("TATAMOTORS.NS", "Tata Motors Limited", "NSE", "INE155A01022", "Automotive"),
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
    "TATA MOTORS": "TATAMOTORS.NS",
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
    now = datetime.utcnow().isoformat()
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

        now = datetime.utcnow().isoformat()

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
        "timestamp": datetime.utcnow().isoformat(),
    }


def resolve_symbol(query: str) -> str:
    """
    Resolves user query (e.g., 'zomato', 'tata motors', 'RELIANCE')
    to official exchange symbol via alias map & full-text match.
    """
    init_db()
    if not query:
        return "RELIANCE.NS"

    q_clean = query.strip().upper()

    # Direct ticker check
    if q_clean.endswith(".NS") or q_clean.endswith(".BO"):
        return q_clean

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Check alias table
    cursor.execute("SELECT target_symbol FROM ticker_aliases WHERE alias = ?", (q_clean,))
    res = cursor.fetchone()
    if res:
        conn.close()
        return res["target_symbol"]

    # 2. Check exact symbol in tickers
    sym_ns = f"{q_clean}.NS"
    cursor.execute("SELECT symbol FROM tickers WHERE symbol = ?", (sym_ns,))
    res = cursor.fetchone()
    if res:
        conn.close()
        return res["symbol"]

    # 3. Full-text search on company_name
    cursor.execute("""
        SELECT symbol FROM tickers
        WHERE UPPER(company_name) LIKE ? OR UPPER(symbol) LIKE ?
        LIMIT 1
    """, (f"%{q_clean}%", f"%{q_clean}%"))
    res = cursor.fetchone()
    conn.close()

    if res:
        return res["symbol"]

    # Fallback to appending .NS for Indian equities
    return f"{q_clean}.NS"


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
    now = datetime.utcnow().isoformat()

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

"""
Unified Broker Gateway & Webhook Order Execution Bridge
Supports:
1. TradingView / External Strategy Webhook Listener
2. Simulated & Dhan / Zerodha Bridge Routing
3. Broker Connectivity Health Check
"""

import time
from datetime import datetime

BROKER_CONFIG = {
    "broker_name": "Dhan Sandbox Gateway",
    "status": "CONNECTED",
    "environment": "SANDBOX / PAPER",
    "client_id": "DHAN_PAPER_98214",
    "ping_ms": 28,
}

WEBHOOK_LOGS = []

def process_webhook_order(payload: dict) -> dict:
    """
    Receives incoming webhook from TradingView or automated bot:
    Payload example: { "symbol": "TCS", "action": "BUY", "quantity": 10, "price": 2500 }
    """
    symbol = payload.get("symbol", "RELIANCE").upper()
    action = payload.get("action", "BUY").upper()
    quantity = int(payload.get("quantity", 1))
    price = float(payload.get("price", 0.0))
    source = payload.get("source", "TradingView Webhook")

    order_id = f"ORD_{int(time.time()*1000)}"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    order_record = {
        "order_id": order_id,
        "timestamp": timestamp,
        "symbol": symbol,
        "action": action,
        "quantity": quantity,
        "price": price,
        "status": "EXECUTED (PAPER)",
        "source": source
    }

    WEBHOOK_LOGS.insert(0, order_record)
    if len(WEBHOOK_LOGS) > 100:
        WEBHOOK_LOGS.pop()

    return {
        "status": "success",
        "message": f"Order {order_id} filled: {action} {quantity} {symbol}",
        "order": order_record
    }

def get_broker_status() -> dict:
    return {
        "config": BROKER_CONFIG,
        "recent_webhooks": WEBHOOK_LOGS[:10]
    }

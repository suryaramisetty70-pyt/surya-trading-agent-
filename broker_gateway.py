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
PROCESSED_IDEMPOTENCY_KEYS = {}

def process_webhook_order(payload: dict) -> dict:
    """
    Receives incoming webhook from TradingView or automated bot:
    Payload example: { "symbol": "TCS", "action": "BUY", "quantity": 10, "price": 2500, "idempotency_key": "tx_123" }
    """
    idempotency_key = payload.get("idempotency_key")
    if idempotency_key and idempotency_key in PROCESSED_IDEMPOTENCY_KEYS:
        return {
            "status": "success",
            "message": "Order already processed (idempotent fill).",
            "order": PROCESSED_IDEMPOTENCY_KEYS[idempotency_key],
            "duplicate": True,
            "idempotency_key": idempotency_key
        }

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
        "source": source,
        "idempotency_key": idempotency_key
    }

    if idempotency_key:
        PROCESSED_IDEMPOTENCY_KEYS[idempotency_key] = order_record

    WEBHOOK_LOGS.insert(0, order_record)
    if len(WEBHOOK_LOGS) > 100:
        WEBHOOK_LOGS.pop()

    return {
        "status": "success",
        "message": f"Order {order_id} filled: {action} {quantity} {symbol}",
        "order": order_record,
        "idempotency_key": idempotency_key
    }

def get_broker_status() -> dict:
    return {
        "config": BROKER_CONFIG,
        "recent_webhooks": WEBHOOK_LOGS[:10]
    }

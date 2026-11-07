"""Provider-neutral guards. Wire to the existing repository at its API boundaries."""
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
import json
from math import isfinite
import re
from typing import Callable


class MarketError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code

    def payload(self):
        return {"error": {"code": self.code, "message": str(self)}}


@dataclass(frozen=True)
class Instrument:
    instrument_id: str
    exchange: str
    symbol: str
    currency: str
    active: bool = True


def resolve_instrument(symbol: str, exchange: str, lookup: Callable):
    """Lookup must return an exact effective alias match from the instrument master."""
    normalized = symbol.strip().upper()
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9&.\-]{0,39}", normalized):
        raise MarketError(400, "INVALID_SYMBOL", "Enter a valid ticker.")
    instrument = lookup(exchange.strip().upper(), normalized)
    if instrument is None:
        raise MarketError(404, "UNKNOWN_SYMBOL", "Ticker was not found.")
    if not instrument.active:
        raise MarketError(422, "INACTIVE_SYMBOL", "Ticker is inactive.")
    return instrument


def strict_json(payload):
    """Serialize native Python values only. Normalize provider/NumPy types upstream."""
    try:
        return json.dumps(payload, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise MarketError(500, "INVALID_RESPONSE", "Market response could not be serialized.") from exc


def required_number(value, name):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value):
        raise MarketError(422, "INSUFFICIENT_DATA", f"{name} is unavailable.")
    return value


@dataclass(frozen=True)
class Quote:
    quote_id: str
    instrument_id: str
    currency: str
    price: Decimal
    observed_at: datetime
    source: str
    status: str


def paper_quote(quote: Quote, instrument: Instrument, now: datetime, max_age: timedelta):
    """Call server-side after loading the current entitled quote."""
    if quote.instrument_id != instrument.instrument_id or quote.currency != instrument.currency:
        raise MarketError(409, "QUOTE_MISMATCH", "Quote does not match the selected stock.")
    if not quote.quote_id or not quote.source or not quote.price.is_finite() or quote.price <= 0:
        raise MarketError(422, "INVALID_QUOTE", "No usable quote is available.")
    if quote.observed_at.utcoffset() is None or now.utcoffset() is None:
        raise MarketError(422, "INVALID_QUOTE_TIME", "Quote timestamp is incomplete.")
    age = now - quote.observed_at
    if quote.status != "LIVE" or age < timedelta(0) or age > max_age:
        raise MarketError(409, "QUOTE_UNAVAILABLE", "A fresh execution quote is required.")
    return quote

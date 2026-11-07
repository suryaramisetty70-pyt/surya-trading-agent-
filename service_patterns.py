"""Async service adapters. Providers must use cancellable I/O and explicit timeouts."""
import asyncio
from dataclasses import dataclass

from market_guard import MarketError


class UpstreamUnavailable(Exception):
    """Translate known provider failures to this error inside each provider adapter."""


async def screener(load_rows, timeout=8):
    try:
        rows = await asyncio.wait_for(load_rows(), timeout)
    except TimeoutError as exc:
        raise MarketError(504, "SCREENER_TIMEOUT", "Market feed timed out. Retry.") from exc
    except UpstreamUnavailable as exc:
        raise MarketError(503, "SCREENER_UNAVAILABLE", "Market feed is unavailable.") from exc
    return {"state": "ready" if rows else "empty", "rows": rows}


@dataclass(frozen=True)
class ReportFacts:
    instrument_id: str
    forecast_id: str
    as_of: str
    horizon_sessions: int
    direction: str


async def ai_report(facts: ReportFacts, validated_provider=None, timeout=10):
    """Provider adapter must return verified text or raise UpstreamUnavailable."""
    if validated_provider is not None:
        try:
            content = await asyncio.wait_for(validated_provider(facts), timeout)
            if isinstance(content, str) and content.strip():
                return {"source": "ai", "instrument_id": facts.instrument_id,
                        "forecast_id": facts.forecast_id, "text": content}
        except (TimeoutError, UpstreamUnavailable):
            pass
    return {
        "source": "structured_fallback",
        "instrument_id": facts.instrument_id,
        "forecast_id": facts.forecast_id,
        "text": (
            f"Forecast as of {facts.as_of}: {facts.direction} over "
            f"{facts.horizon_sessions} trading sessions."
        ),
    }

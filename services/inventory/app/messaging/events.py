import json
import uuid
from datetime import UTC, datetime
from typing import Any, TypedDict


class Event(TypedDict):
    id: str
    type: str
    source: str
    occurredAt: str
    correlationId: str
    data: dict[str, Any]


def build_event(event_type: str, source: str, correlation_id: str, data: dict[str, Any]) -> Event:
    return {
        "id": str(uuid.uuid4()),
        "type": event_type,
        "source": source,
        "occurredAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "correlationId": correlation_id,
        "data": data,
    }


def parse_event(raw: str) -> Event:
    event = json.loads(raw)
    missing = {"id", "type", "correlationId", "data"} - event.keys()
    if missing:
        raise ValueError(f"event is missing fields: {sorted(missing)}")
    return event

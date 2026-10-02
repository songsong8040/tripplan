"""SQLite 기반 여행 방(Trip) 저장소.

방 하나를 JSON 문서 한 건으로 저장하고, 변경마다 version 을 올린다.
클라이언트는 version 을 폴링해 다른 참여자의 변경을 감지한다.
"""

from __future__ import annotations

import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Callable, Iterator, TypeVar

from .schemas import ActivityLog, TripState

T = TypeVar("T")

MAX_ACTIVITY = 200


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def new_id() -> str:
    return uuid.uuid4().hex[:12]


class TripNotFound(Exception):
    pass


class TripStore:
    def __init__(self, path: str) -> None:
        self._path = path
        self._lock = threading.Lock()
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS trips (
                    id TEXT PRIMARY KEY,
                    version INTEGER NOT NULL,
                    data TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self._path)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def create(self) -> TripState:
        ts = now_iso()
        trip = TripState(id=str(uuid.uuid4()), created_at=ts, updated_at=ts)
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO trips (id, version, data, updated_at) VALUES (?, ?, ?, ?)",
                (trip.id, trip.version, trip.model_dump_json(), ts),
            )
        return trip

    def get(self, trip_id: str) -> TripState:
        with self._connect() as conn:
            row = conn.execute("SELECT data FROM trips WHERE id = ?", (trip_id,)).fetchone()
        if not row:
            raise TripNotFound(trip_id)
        return TripState.model_validate_json(row[0])

    def version(self, trip_id: str) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT version FROM trips WHERE id = ?", (trip_id,)).fetchone()
        if not row:
            raise TripNotFound(trip_id)
        return int(row[0])

    def mutate(self, trip_id: str, fn: Callable[[TripState], T]) -> tuple[TripState, T]:
        """방 상태를 원자적으로 수정한다. fn 이 예외를 던지면 저장하지 않는다."""
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT data FROM trips WHERE id = ?", (trip_id,)).fetchone()
            if not row:
                raise TripNotFound(trip_id)
            trip = TripState.model_validate_json(row[0])
            result = fn(trip)
            trip.version += 1
            trip.updated_at = now_iso()
            trip.activity = trip.activity[-MAX_ACTIVITY:]
            conn.execute(
                "UPDATE trips SET version = ?, data = ?, updated_at = ? WHERE id = ?",
                (trip.version, trip.model_dump_json(), trip.updated_at, trip_id),
            )
        return trip, result


def log(trip: TripState, actor: str, action: str, target: str = "") -> None:
    trip.activity.append(ActivityLog(id=new_id(), actor=actor, action=action, target=target, at=now_iso()))

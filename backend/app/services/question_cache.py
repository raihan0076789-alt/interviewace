import time
from threading import Lock


class TTLCache:
    def __init__(self, ttl_seconds: int):
        self._ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[float, list[str]]] = {}
        self._lock = Lock()

    @staticmethod
    def _make_key(role: str, difficulty: str, count: int) -> str:
        return f"{role.strip().lower()}::{difficulty.strip().lower()}::{count}"

    def get(self, role: str, difficulty: str, count: int) -> list[str] | None:
        key = self._make_key(role, difficulty, count)
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            cached_at, questions = entry
            if time.monotonic() - cached_at > self._ttl_seconds:
                del self._store[key]
                return None
            return questions

    def set(self, role: str, difficulty: str, count: int, questions: list[str]) -> None:
        key = self._make_key(role, difficulty, count)
        with self._lock:
            self._store[key] = (time.monotonic(), questions)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
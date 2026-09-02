from __future__ import annotations

from app.services.image_storage import ImageStorage, StoredImage


class SelectedMediaRepository:
    """Restricts backup reads to canonical database-referenced media keys."""

    def __init__(self, storage: ImageStorage, keys: list[str]) -> None:
        self.storage = storage
        self.keys = sorted(set(keys))

    def list_keys(self) -> list[str]:
        return self.keys

    def get(self, key: str) -> StoredImage | None:
        return self.storage.get(key)

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self.storage.put(key, content, content_type)

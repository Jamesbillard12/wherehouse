from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class StoredImage:
    content: bytes
    content_type: str


class ImageStorage(Protocol):
    def put(self, key: str, content: bytes, content_type: str) -> None: ...

    def get(self, key: str) -> StoredImage | None: ...

    def delete(self, key: str) -> None: ...

    def list_keys(self) -> list[str]: ...


CONTENT_TYPES_BY_SUFFIX = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


class LocalImageStorage:
    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError("Invalid image storage key")
        return path

    def put(self, key: str, content: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def get(self, key: str) -> StoredImage | None:
        path = self._path(key)
        if not path.is_file():
            return None
        content_type = CONTENT_TYPES_BY_SUFFIX.get(path.suffix.lower(), "application/octet-stream")
        return StoredImage(content=path.read_bytes(), content_type=content_type)

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink()

    def list_keys(self) -> list[str]:
        if not self.root.exists():
            return []
        return sorted(
            path.relative_to(self.root).as_posix()
            for path in self.root.rglob("*")
            if path.is_file()
        )


class S3ImageStorage:
    def __init__(self, settings: Settings) -> None:
        if not settings.s3_bucket:
            raise RuntimeError("S3_BUCKET is required when IMAGE_STORAGE_BACKEND=s3")
        import boto3

        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            region_name=settings.s3_region,
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
        )

    def get(self, key: str) -> StoredImage | None:
        from botocore.exceptions import ClientError

        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
                return None
            raise
        return StoredImage(
            content=response["Body"].read(),
            content_type=response.get("ContentType", "application/octet-stream"),
        )

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def list_keys(self) -> list[str]:
        keys: list[str] = []
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket):
            keys.extend(item["Key"] for item in page.get("Contents", []))
        return sorted(keys)


@lru_cache
def get_image_storage() -> ImageStorage:
    settings = get_settings()
    backend = settings.image_storage_backend.lower()
    if backend == "local":
        return LocalImageStorage(settings.upload_dir)
    if backend == "s3":
        return S3ImageStorage(settings)
    raise RuntimeError(f"Unsupported IMAGE_STORAGE_BACKEND: {settings.image_storage_backend}")

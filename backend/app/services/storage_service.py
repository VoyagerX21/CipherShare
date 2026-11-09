import os
import io
import re
from abc import ABC, abstractmethod
from pathlib import Path
from flask import current_app

UUID_PATTERN = re.compile(r'^[0-9a-fA-F-]{36}$')

class BaseStorageService(ABC):
    @abstractmethod
    def save_object(self, object_key: str, data: bytes) -> dict:
        """Stores encrypted bytes. Returns metadata dict."""
        pass

    @abstractmethod
    def get_object_bytes(self, object_key: str) -> bytes:
        """Retrieves raw encrypted bytes for the object."""
        pass

    @abstractmethod
    def object_exists(self, object_key: str) -> bool:
        """Checks if the object exists in storage."""
        pass

    @abstractmethod
    def delete_object(self, object_key: str) -> bool:
        """Deletes the object from storage."""
        pass

    @abstractmethod
    def get_storage_type(self) -> str:
        """Returns the identifier of the storage provider."""
        pass


class LocalStorageService(BaseStorageService):
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, object_key: str) -> Path:
        # Sanitize object_key to prevent directory traversal
        clean_key = Path(object_key).name
        target = (self.base_dir / clean_key).resolve()
        if not str(target).startswith(str(self.base_dir.resolve())):
            raise ValueError("Invalid storage path: directory traversal attempt")
        return target

    def save_object(self, object_key: str, data: bytes) -> dict:
        target_path = self._resolve_path(object_key)
        target_path.write_bytes(data)
        return {
            'storage_type': 'local',
            'object_key': object_key,
            'bytes_written': len(data),
            'path': str(target_path)
        }

    def get_object_bytes(self, object_key: str) -> bytes:
        target_path = self._resolve_path(object_key)
        if not target_path.exists():
            raise FileNotFoundError(f"Storage object {object_key} does not exist")
        return target_path.read_bytes()

    def object_exists(self, object_key: str) -> bool:
        return self._resolve_path(object_key).exists()

    def delete_object(self, object_key: str) -> bool:
        target_path = self._resolve_path(object_key)
        if target_path.exists():
            target_path.unlink()
            return True
        return False

    def get_storage_type(self) -> str:
        return "local"


class SupabaseStorageService(BaseStorageService):
    def __init__(self, supabase_url: str, service_role_key: str, bucket_name: str, fallback_local: LocalStorageService):
        self.supabase_url = supabase_url.rstrip('/') if supabase_url else ''
        self.service_role_key = service_role_key
        self.bucket_name = bucket_name
        self.fallback_local = fallback_local

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.service_role_key}",
            "apiKey": self.service_role_key
        }

    def is_configured(self) -> bool:
        return bool(self.supabase_url and self.service_role_key)

    def save_object(self, object_key: str, data: bytes) -> dict:
        if not self.is_configured():
            return self.fallback_local.save_object(object_key, data)

        try:
            import requests
            upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{object_key}"
            headers = {
                **self._get_headers(),
                "Content-Type": "application/octet-stream",
                "x-upsert": "true"
            }
            resp = requests.post(upload_url, data=data, headers=headers, timeout=15)
            if resp.status_code in [200, 201]:
                return {
                    'storage_type': 'supabase',
                    'object_key': object_key,
                    'bytes_written': len(data),
                    'bucket': self.bucket_name
                }
            else:
                current_app.logger.warning(f"Supabase REST upload failed ({resp.status_code}): {resp.text}. Falling back to local.")
                return self.fallback_local.save_object(object_key, data)
        except Exception as e:
            current_app.logger.error(f"Supabase upload error: {e}. Falling back to local storage.")
            return self.fallback_local.save_object(object_key, data)

    def get_object_bytes(self, object_key: str) -> bytes:
        if not self.is_configured():
            return self.fallback_local.get_object_bytes(object_key)

        try:
            import requests
            download_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{object_key}"
            resp = requests.get(download_url, headers=self._get_headers(), timeout=15)
            if resp.status_code == 200:
                return resp.content
            else:
                current_app.logger.warning(f"Supabase REST download returned {resp.status_code}. Trying fallback local storage.")
                return self.fallback_local.get_object_bytes(object_key)
        except Exception as e:
            current_app.logger.warning(f"Supabase download error: {e}. Trying fallback local storage.")
            return self.fallback_local.get_object_bytes(object_key)

    def object_exists(self, object_key: str) -> bool:
        if not self.is_configured():
            return self.fallback_local.object_exists(object_key)
        try:
            import requests
            list_url = f"{self.supabase_url}/storage/v1/object/list/{self.bucket_name}"
            resp = requests.post(
                list_url,
                json={"prefix": "", "search": object_key},
                headers={**self._get_headers(), "Content-Type": "application/json"},
                timeout=10
            )
            if resp.status_code == 200:
                items = resp.json()
                return any(item.get('name') == object_key for item in items)
            return self.fallback_local.object_exists(object_key)
        except Exception:
            return self.fallback_local.object_exists(object_key)

    def delete_object(self, object_key: str) -> bool:
        if not self.is_configured():
            return self.fallback_local.delete_object(object_key)
        try:
            import requests
            delete_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{object_key}"
            resp = requests.delete(delete_url, headers=self._get_headers(), timeout=10)
            if resp.status_code in [200, 204]:
                return True
            # Fallback to prefixes deletion
            resp2 = requests.delete(
                f"{self.supabase_url}/storage/v1/object/{self.bucket_name}",
                json={"prefixes": [object_key]},
                headers={**self._get_headers(), "Content-Type": "application/json"},
                timeout=10
            )
            return resp2.status_code in [200, 204]
        except Exception:
            return self.fallback_local.delete_object(object_key)

    def get_storage_type(self) -> str:
        return "supabase" if self.is_configured() else "local (supabase unconfigured)"


def get_storage_service() -> BaseStorageService:
    storage_type = current_app.config.get('STORAGE_TYPE', 'local')
    local_dir = current_app.config.get('LOCAL_STORAGE_DIR')
    local_service = LocalStorageService(local_dir)

    if storage_type == 'supabase':
        url = current_app.config.get('SUPABASE_URL', '')
        key = current_app.config.get('SUPABASE_SERVICE_ROLE_KEY', '')
        bucket = current_app.config.get('SUPABASE_BUCKET', 'ciphershare-encrypted-files')
        return SupabaseStorageService(url, key, bucket, fallback_local=local_service)
    return local_service


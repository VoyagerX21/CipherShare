import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "ciphershare-dev-secret-key-change-in-production")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ciphershare-jwt-dev-secret-change-in-prod")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("JWT_EXPIRY_HOURS", "8")))

    # Database
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        # Default SQLite database in instance folder
        instance_dir = BASE_DIR / "instance"
        instance_dir.mkdir(exist_ok=True)
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{instance_dir / 'ciphershare.db'}"
    else:
        # If postgres:// is provided (e.g. from older Supabase strings), convert to postgresql://
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        SQLALCHEMY_DATABASE_URI = DATABASE_URL

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Storage Adapter: "local" or "supabase"
    STORAGE_TYPE = os.getenv("STORAGE_TYPE", "local").lower()

    # Local Storage Configuration
    LOCAL_STORAGE_DIR = BASE_DIR / "storage" / "encrypted_blobs"
    LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    # Supabase Configuration
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "ciphershare-encrypted-files")

    # Cryptographic & File Limits
    MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_BYTES", str(25 * 1024 * 1024))) # 25 MB
    ALLOWED_CRYPTO_VERSIONS = ["1.0"]

    # CORS
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]


class TestConfig(Config):
    TESTING = True
    instance_test_dir = BASE_DIR / "instance"
    instance_test_dir.mkdir(exist_ok=True)
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{instance_test_dir / 'ciphershare_test.db'}"
    STORAGE_TYPE = "local"
    LOCAL_STORAGE_DIR = BASE_DIR / "storage" / "test_blobs"
    LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

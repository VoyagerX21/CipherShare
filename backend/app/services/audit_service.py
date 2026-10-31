import logging
from backend.app.extensions import db
from backend.app.models.audit import AuditEvent

logger = logging.getLogger(__name__)

# Keys that must never appear in safe_metadata
DISALLOWED_METADATA_KEYS = {
    'password', 'password_hash', 'token', 'private_key', 'private_key_pem',
    'private_key_jwk', 'aes_key', 'raw_key', 'passphrase', 'secret',
    'file_content', 'plaintext'
}

def sanitize_metadata(meta: dict) -> dict:
    if not isinstance(meta, dict):
        return {}
    clean = {}
    for k, v in meta.items():
        if str(k).lower() in DISALLOWED_METADATA_KEYS:
            continue
        if isinstance(v, dict):
            clean[k] = sanitize_metadata(v)
        elif isinstance(v, (str, int, float, bool, list)):
            clean[k] = v
        else:
            clean[k] = str(v)
    return clean

def log_audit_event(event_type: str, result: str, actor_user_id=None, file_id=None, metadata=None):
    """
    Persist an audit event safely to the database.
    Guarantees no raw secrets are persisted.
    """
    clean_meta = sanitize_metadata(metadata or {})
    try:
        event = AuditEvent(
            actor_user_id=actor_user_id,
            file_id=file_id,
            event_type=event_type,
            result=result,
            safe_metadata=clean_meta
        )
        db.session.add(event)
        db.session.commit()
        return event
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to record audit event: {e}")
        return None


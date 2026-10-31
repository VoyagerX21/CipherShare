import uuid
from datetime import datetime, timezone
from backend.app.extensions import db

class AuditEvent(db.Model):
    __tablename__ = 'audit_events'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    file_id = db.Column(db.String(36), db.ForeignKey('shared_files.id', ondelete='SET NULL'), nullable=True, index=True)
    event_type = db.Column(db.String(64), nullable=False, index=True)
    result = db.Column(db.String(32), nullable=False) # SUCCESS, DENIED, FAILED, TAMPER_DETECTED
    safe_metadata = db.Column(db.JSON, nullable=False, default=dict) # Never sensitive secrets
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    actor = db.relationship('User', lazy='joined')
    file = db.relationship('SharedFile', lazy='joined')

    def to_dict(self):
        return {
            'id': self.id,
            'actor_user_id': self.actor_user_id,
            'actor_email': self.actor.email if self.actor else 'anonymous',
            'file_id': self.file_id,
            'original_filename': self.file.original_filename if self.file else None,
            'event_type': self.event_type,
            'result': self.result,
            'safe_metadata': self.safe_metadata,
            'created_at': self.created_at.isoformat()
        }

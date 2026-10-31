import uuid
from datetime import datetime, timezone
from backend.app.extensions import db

class UserPublicKey(db.Model):
    __tablename__ = 'user_public_keys'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    key_type = db.Column(db.String(64), nullable=False, default='RSA-OAEP-3072')
    algorithm = db.Column(db.String(64), nullable=False, default='RSA-OAEP')
    public_key_jwk = db.Column(db.Text, nullable=False) # JSON string representation
    fingerprint = db.Column(db.String(64), nullable=False, index=True) # SHA-256 hex string
    key_version = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    revoked_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'key_type': self.key_type,
            'algorithm': self.algorithm,
            'public_key_jwk': self.public_key_jwk,
            'fingerprint': self.fingerprint,
            'key_version': self.key_version,
            'created_at': self.created_at.isoformat(),
            'revoked_at': self.revoked_at.isoformat() if self.revoked_at else None
        }


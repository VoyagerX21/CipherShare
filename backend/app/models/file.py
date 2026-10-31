import uuid
from datetime import datetime, timezone
from backend.app.extensions import db

class SharedFile(db.Model):
    __tablename__ = 'shared_files'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    original_filename = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(128), nullable=False, default='application/octet-stream')
    file_size = db.Column(db.BigInteger, nullable=False)
    storage_object_key = db.Column(db.String(255), nullable=False, unique=True, index=True)
    crypto_version = db.Column(db.String(16), nullable=False, default='1.0')
    encryption_algorithm = db.Column(db.String(64), nullable=False, default='AES-256-GCM')
    key_wrapping_algorithm = db.Column(db.String(64), nullable=False, default='RSA-OAEP-SHA256')
    nonce = db.Column(db.String(64), nullable=False) # Base64 encoded 12-byte IV
    ciphertext_sha256 = db.Column(db.String(64), nullable=False) # Hex digest
    plaintext_sha256 = db.Column(db.String(64), nullable=True) # Optional client computed hex digest
    aad_version = db.Column(db.String(16), nullable=False, default='1.0')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    status = db.Column(db.String(32), nullable=False, default='pending') # pending, completed, revoked

    # Relationships
    recipients = db.relationship('FileRecipient', backref='shared_file', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_recipients=False):
        data = {
            'id': self.id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.name if self.sender else None,
            'sender_email': self.sender.email if self.sender else None,
            'original_filename': self.original_filename,
            'content_type': self.content_type,
            'file_size': self.file_size,
            'crypto_version': self.crypto_version,
            'encryption_algorithm': self.encryption_algorithm,
            'key_wrapping_algorithm': self.key_wrapping_algorithm,
            'nonce': self.nonce,
            'ciphertext_sha256': self.ciphertext_sha256,
            'plaintext_sha256': self.plaintext_sha256,
            'aad_version': self.aad_version,
            'created_at': self.created_at.isoformat(),
            'status': self.status
        }
        if include_recipients:
            data['recipients'] = [r.to_dict() for r in self.recipients.all()]
        return data


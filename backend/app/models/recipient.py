import uuid
from datetime import datetime, timezone
from backend.app.extensions import db

class FileRecipient(db.Model):
    __tablename__ = 'file_recipients'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = db.Column(db.String(36), db.ForeignKey('shared_files.id', ondelete='CASCADE'), nullable=False, index=True)
    recipient_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    recipient_public_key_id = db.Column(db.String(36), db.ForeignKey('user_public_keys.id', ondelete='RESTRICT'), nullable=False)
    encrypted_aes_key = db.Column(db.Text, nullable=False) # Base64 encoded RSA-wrapped AES key
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    access_status = db.Column(db.String(32), nullable=False, default='shared') # shared, accessed, revoked

    __table_args__ = (
        db.UniqueConstraint('file_id', 'recipient_id', name='uq_file_recipient'),
    )

    recipient_public_key = db.relationship('UserPublicKey', lazy='joined')

    def to_dict(self):
        return {
            'id': self.id,
            'file_id': self.file_id,
            'recipient_id': self.recipient_id,
            'recipient_name': self.recipient.name if self.recipient else None,
            'recipient_email': self.recipient.email if self.recipient else None,
            'recipient_public_key_id': self.recipient_public_key_id,
            'access_status': self.access_status,
            'created_at': self.created_at.isoformat()
        }

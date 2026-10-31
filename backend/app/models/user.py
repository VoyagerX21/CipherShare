import uuid
from datetime import datetime, timezone
from backend.app.extensions import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    public_keys = db.relationship('UserPublicKey', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    sent_files = db.relationship('SharedFile', backref='sender', lazy='dynamic', cascade='all, delete-orphan')
    received_shares = db.relationship('FileRecipient', backref='recipient', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }


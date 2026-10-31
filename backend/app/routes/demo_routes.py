from flask import Blueprint, jsonify, current_app
from backend.app.extensions import db
from backend.app.models.user import User
from backend.app.models.key import UserPublicKey
from backend.app.models.file import SharedFile
from backend.app.models.recipient import FileRecipient
from backend.app.models.audit import AuditEvent
from backend.app.services.auth_service import hash_password
from backend.app.services.audit_service import log_audit_event

demo_bp = Blueprint('demo', __name__, url_prefix='/api/v1/demo')

DEMO_USERS = [
    {
        'name': 'Alice Sender',
        'email': 'sender@demo.local',
        'password': 'DemoSender123!',
        'role': 'Sender'
    },
    {
        'name': 'Bob Recipient',
        'email': 'recipient@demo.local',
        'password': 'DemoRecipient123!',
        'role': 'Intended Recipient'
    },
    {
        'name': 'Eve Intruder',
        'email': 'intruder@demo.local',
        'password': 'DemoIntruder123!',
        'role': 'Unauthorized User'
    }
]

@demo_bp.route('/status', methods=['GET'])
def demo_status():
    status = []
    for du in DEMO_USERS:
        u = User.query.filter_by(email=du['email']).first()
        if u:
            active_key = UserPublicKey.query.filter_by(user_id=u.id, revoked_at=None).first()
            status.append({
                'name': u.name,
                'email': u.email,
                'role': du['role'],
                'exists': True,
                'has_public_key': active_key is not None,
                'public_key_fingerprint': active_key.fingerprint if active_key else None
            })
        else:
            status.append({
                'name': du['name'],
                'email': du['email'],
                'role': du['role'],
                'exists': False,
                'has_public_key': False,
                'public_key_fingerprint': None
            })
    return jsonify({
        'demo_users': status,
        'storage_type': current_app.config.get('STORAGE_TYPE', 'local')
    }), 200


@demo_bp.route('/seed', methods=['POST'])
def seed_demo_users():
    """
    Creates or updates the 3 standard demo users.
    Note: Private keys must be generated locally in the browser upon first login!
    """
    created_count = 0
    for du in DEMO_USERS:
        user = User.query.filter_by(email=du['email']).first()
        if not user:
            user = User(
                name=du['name'],
                email=du['email'],
                password_hash=hash_password(du['password']),
                is_active=True
            )
            db.session.add(user)
            created_count += 1
        else:
            # Refresh password to standard demo password
            user.password_hash = hash_password(du['password'])
            user.is_active = True

    db.session.commit()

    log_audit_event(
        event_type='DEMO_ENVIRONMENT_SEEDED',
        result='SUCCESS',
        metadata={'demo_accounts': [u['email'] for u in DEMO_USERS]}
    )

    return jsonify({
        'message': f'Demo environment seeded successfully ({created_count} users created/updated)',
        'accounts': [
            {'role': u['role'], 'email': u['email'], 'password': u['password']}
            for u in DEMO_USERS
        ]
    }), 200


@demo_bp.route('/reset', methods=['POST'])
def reset_demo():
    """
    Resets shared files, recipients, and non-system audit events for a fresh demonstration.
    """
    # Delete recipients and files
    FileRecipient.query.delete()
    SharedFile.query.delete()
    AuditEvent.query.filter(AuditEvent.event_type != 'DEMO_ENVIRONMENT_SEEDED').delete()
    db.session.commit()

    log_audit_event(
        event_type='DEMO_ENVIRONMENT_RESET',
        result='SUCCESS',
        metadata={'message': 'Demo files, recipients, and test logs cleared'}
    )

    return jsonify({'message': 'Demo data reset successfully for a fresh presentation'}), 200

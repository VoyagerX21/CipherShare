from flask import Blueprint, request, jsonify, g
from backend.app.extensions import db
from backend.app.models.user import User
from backend.app.models.key import UserPublicKey
from backend.app.services.auth_service import jwt_required
from backend.app.services.crypto_metadata_service import validate_public_key_payload
from backend.app.services.audit_service import log_audit_event

key_bp = Blueprint('keys', __name__, url_prefix='/api/v1')

@key_bp.route('/keys', methods=['POST'])
@jwt_required
def register_public_key():
    data = request.get_json(silent=True) or {}
    user = g.current_user

    # Security check: Never accept private keys
    if any(k in data for k in ['private_key', 'privateKey', 'd', 'p', 'q', 'dp', 'dq', 'qi']):
        log_audit_event('PRIVATE_KEY_UPLOAD_BLOCKED', 'DENIED', actor_user_id=user.id)
        return jsonify({'error': 'Bad Request', 'message': 'Private key material must NEVER be submitted to the server.'}), 400

    is_valid, err_msg = validate_public_key_payload(data)
    if not is_valid:
        return jsonify({'error': 'Bad Request', 'message': err_msg}), 400

    jwk_str = data['public_key_jwk'] if isinstance(data['public_key_jwk'], str) else str(data['public_key_jwk'])
    fingerprint = data.get('fingerprint')

    # Deactivate / mark previous active keys if replacing
    existing_keys = UserPublicKey.query.filter_by(user_id=user.id, revoked_at=None).all()
    for ek in existing_keys:
        ek.revoked_at = db.func.now()

    new_key = UserPublicKey(
        user_id=user.id,
        key_type=data.get('key_type', 'RSA-OAEP-3072'),
        algorithm=data.get('algorithm', 'RSA-OAEP'),
        public_key_jwk=jwk_str,
        fingerprint=fingerprint,
        key_version=(len(existing_keys) + 1)
    )
    db.session.add(new_key)
    db.session.commit()

    log_audit_event(
        event_type='PUBLIC_KEY_REGISTERED',
        result='SUCCESS',
        actor_user_id=user.id,
        metadata={
            'key_id': new_key.id,
            'fingerprint': fingerprint,
            'key_type': new_key.key_type
        }
    )

    return jsonify(new_key.to_dict()), 201


@key_bp.route('/keys/me', methods=['GET'])
@jwt_required
def get_my_public_key():
    user = g.current_user
    pubkey = UserPublicKey.query.filter_by(user_id=user.id, revoked_at=None).order_by(UserPublicKey.created_at.desc()).first()
    if not pubkey:
        return jsonify({'key': None, 'message': 'No public key registered for this account'}), 200
    return jsonify({'key': pubkey.to_dict()}), 200


@key_bp.route('/users/search', methods=['GET'])
@jwt_required
def search_users():
    q = request.args.get('q', '').strip()
    query = User.query.filter(User.is_active == True, User.id != g.current_user.id)
    if q:
        query = query.filter((User.email.ilike(f"%{q}%")) | (User.name.ilike(f"%{q}%")))

    users = query.limit(20).all()
    results = []
    for u in users:
        active_key = UserPublicKey.query.filter_by(user_id=u.id, revoked_at=None).order_by(UserPublicKey.created_at.desc()).first()
        results.append({
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'has_public_key': active_key is not None,
            'public_key_fingerprint': active_key.fingerprint if active_key else None
        })

    return jsonify({'users': results}), 200


@key_bp.route('/users/<user_id>/public-key', methods=['GET'])
@jwt_required
def get_user_public_key(user_id):
    user = User.query.filter_by(id=user_id, is_active=True).first()
    if not user:
        return jsonify({'error': 'Not Found', 'message': 'User not found'}), 404

    active_key = UserPublicKey.query.filter_by(user_id=user.id, revoked_at=None).order_by(UserPublicKey.created_at.desc()).first()
    if not active_key:
        return jsonify({'error': 'Not Found', 'message': 'User has no registered public key'}), 404

    return jsonify({
        'user_id': user.id,
        'name': user.name,
        'email': user.email,
        'public_key': active_key.to_dict()
    }), 200


@key_bp.route('/keys/fingerprint/<user_id>', methods=['GET'])
@jwt_required
def get_user_fingerprint(user_id):
    active_key = UserPublicKey.query.filter_by(user_id=user_id, revoked_at=None).order_by(UserPublicKey.created_at.desc()).first()
    if not active_key:
        return jsonify({'error': 'Not Found', 'message': 'Key not found'}), 404
    return jsonify({
        'user_id': user_id,
        'fingerprint': active_key.fingerprint
    }), 200

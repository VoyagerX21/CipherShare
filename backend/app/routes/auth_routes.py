from flask import Blueprint, request, jsonify, g
from backend.app.extensions import db
from backend.app.models.user import User
from backend.app.services.auth_service import hash_password, verify_password, generate_jwt_token, jwt_required
from backend.app.services.audit_service import log_audit_event

auth_bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({'error': 'Bad Request', 'message': 'Name, email, and password are required'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Bad Request', 'message': 'Password must be at least 8 characters long'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Conflict', 'message': 'A user with this email already exists'}), 409

    pwd_hash = hash_password(password)
    user = User(
        name=name,
        email=email,
        password_hash=pwd_hash,
        is_active=True
    )
    db.session.add(user)
    db.session.commit()

    token = generate_jwt_token(user)

    log_audit_event(
        event_type='USER_REGISTERED',
        result='SUCCESS',
        actor_user_id=user.id,
        metadata={'email': user.email, 'name': user.name}
    )

    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Bad Request', 'message': 'Email and password are required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not verify_password(user.password_hash, password):
        log_audit_event(
            event_type='USER_LOGIN_FAILED',
            result='FAILED',
            actor_user_id=user.id if user else None,
            metadata={'attempted_email': email}
        )
        return jsonify({'error': 'Unauthorized', 'message': 'Invalid email or password'}), 401

    if not user.is_active:
        return jsonify({'error': 'Forbidden', 'message': 'User account is deactivated'}), 403

    token = generate_jwt_token(user)

    log_audit_event(
        event_type='USER_LOGIN_SUCCESS',
        result='SUCCESS',
        actor_user_id=user.id,
        metadata={'email': user.email}
    )

    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required
def me():
    return jsonify({
        'user': g.current_user.to_dict()
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required
def logout():
    log_audit_event(
        event_type='USER_LOGOUT',
        result='SUCCESS',
        actor_user_id=g.current_user.id,
        metadata={'email': g.current_user.email}
    )
    return jsonify({'message': 'Logged out successfully'}), 200


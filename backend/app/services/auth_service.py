import functools
import jwt
from datetime import datetime, timezone
from flask import request, jsonify, current_app, g
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from backend.app.models.user import User

ph = PasswordHasher()

def hash_password(password: str) -> str:
    """Hashes a password using Argon2id."""
    return ph.hash(password)

def verify_password(hash_str: str, password: str) -> bool:
    """Verifies a password against an Argon2id hash."""
    try:
        return ph.verify(hash_str, password)
    except (VerifyMismatchError, VerificationError):
        return False
    except Exception:
        return False

def generate_jwt_token(user: User) -> str:
    """Generates a short-lived access JWT for the authenticated user."""
    expires = datetime.now(timezone.utc) + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
    payload = {
        'sub': user.id,
        'email': user.email,
        'name': user.name,
        'iat': datetime.now(timezone.utc),
        'exp': expires
    }
    token = jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
    return token

def decode_jwt_token(token: str) -> dict:
    """Decodes and validates a JWT token."""
    return jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])

def jwt_required(f):
    """Decorator to require a valid Bearer JWT for route access."""
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized', 'message': 'Missing or invalid Authorization header'}), 401

        token = auth_header.split(' ', 1)[1].strip()
        try:
            payload = decode_jwt_token(token)
            user_id = payload.get('sub')
            user = User.query.filter_by(id=user_id, is_active=True).first()
            if not user:
                return jsonify({'error': 'Unauthorized', 'message': 'User not found or inactive'}), 401
            g.current_user = user
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Unauthorized', 'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'error': 'Unauthorized', 'message': f'Invalid token: {str(e)}'}), 401
        except Exception as e:
            return jsonify({'error': 'Unauthorized', 'message': 'Authentication failed'}), 401

        return f(*args, **kwargs)
    return decorated_function


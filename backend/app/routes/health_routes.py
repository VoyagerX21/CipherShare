from flask import Blueprint, jsonify, current_app
from backend.app.services.storage_service import get_storage_service

health_bp = Blueprint('health', __name__, url_prefix='/api/v1')

@health_bp.route('/health', methods=['GET'])
def health():
    storage = get_storage_service()
    return jsonify({
        'status': 'healthy',
        'application': 'CipherShare Hybrid Cryptography Backend',
        'version': '1.0.0',
        'storage_adapter': storage.get_storage_type(),
        'max_file_size_mb': current_app.config['MAX_FILE_SIZE_BYTES'] // (1024 * 1024),
        'supported_crypto': {
            'symmetric': 'AES-256-GCM',
            'asymmetric': 'RSA-OAEP-3072',
            'digest': 'SHA-256',
            'key_derivation': 'PBKDF2-SHA256 / Argon2id'
        }
    }), 200

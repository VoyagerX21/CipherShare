import uuid
import hashlib
from datetime import datetime, timezone
from flask import current_app
from backend.app.extensions import db
from backend.app.models.user import User
from backend.app.models.key import UserPublicKey
from backend.app.models.file import SharedFile
from backend.app.models.recipient import FileRecipient
from backend.app.services.storage_service import get_storage_service
from backend.app.services.audit_service import log_audit_event

def initiate_file_share(sender: User, payload: dict) -> tuple[dict, int]:
    """
    Validates recipients and creates a pending file record.
    Returns metadata and upload instructions.
    """
    original_filename = payload.get('original_filename', '').strip()
    file_size = payload.get('file_size')
    content_type = payload.get('content_type', 'application/octet-stream')
    recipient_ids = payload.get('recipient_ids', [])

    if not original_filename:
        return {'error': 'Bad Request', 'message': 'original_filename is required'}, 400

    if not file_size or not isinstance(file_size, int) or file_size <= 0:
        return {'error': 'Bad Request', 'message': 'file_size must be a positive integer'}, 400

    max_size = current_app.config['MAX_FILE_SIZE_BYTES']
    if file_size > max_size:
        return {'error': 'Payload Too Large', 'message': f'File exceeds maximum allowed size of {max_size} bytes'}, 413

    if not recipient_ids or not isinstance(recipient_ids, list):
        return {'error': 'Bad Request', 'message': 'recipient_ids list is required'}, 400

    # Ensure no duplicate recipients
    unique_recipients = list(set(recipient_ids))
    valid_recipients = []

    for r_id in unique_recipients:
        recip = User.query.filter_by(id=r_id, is_active=True).first()
        if not recip:
            return {'error': 'Bad Request', 'message': f'Recipient {r_id} does not exist'}, 400
        # Find active public key
        pubkey = UserPublicKey.query.filter_by(user_id=r_id, revoked_at=None).order_by(UserPublicKey.created_at.desc()).first()
        if not pubkey:
            return {'error': 'Bad Request', 'message': f'Recipient {recip.email} has not registered a public key'}, 400
        valid_recipients.append({
            'recipient_id': recip.id,
            'name': recip.name,
            'email': recip.email,
            'public_key_id': pubkey.id,
            'public_key_jwk': pubkey.public_key_jwk,
            'fingerprint': pubkey.fingerprint
        })

    file_id = str(uuid.uuid4())
    storage_object_key = f"{uuid.uuid4().hex}.enc"

    # Temporary placeholder values until complete_share
    shared_file = SharedFile(
        id=file_id,
        sender_id=sender.id,
        original_filename=original_filename,
        content_type=content_type,
        file_size=file_size,
        storage_object_key=storage_object_key,
        crypto_version=payload.get('crypto_version', '1.0'),
        encryption_algorithm='AES-256-GCM',
        key_wrapping_algorithm='RSA-OAEP-SHA256',
        nonce='',
        ciphertext_sha256='',
        plaintext_sha256=payload.get('plaintext_sha256'),
        aad_version='1.0',
        status='pending'
    )
    db.session.add(shared_file)
    db.session.commit()

    log_audit_event(
        event_type='FILE_SHARE_INITIATED',
        result='SUCCESS',
        actor_user_id=sender.id,
        file_id=file_id,
        metadata={
            'original_filename': original_filename,
            'file_size': file_size,
            'recipient_count': len(valid_recipients)
        }
    )

    return {
        'file_id': file_id,
        'storage_object_key': storage_object_key,
        'upload_url': f"/api/v1/files/{file_id}/upload",
        'recipients': valid_recipients
    }, 201


def upload_ciphertext(file_id: str, sender: User, raw_ciphertext: bytes) -> tuple[dict, int]:
    """Stores the client-side encrypted ciphertext in private storage."""
    shared_file = SharedFile.query.filter_by(id=file_id).first()
    if not shared_file:
        return {'error': 'Not Found', 'message': 'File session not found'}, 404

    if shared_file.sender_id != sender.id:
        log_audit_event('UNAUTHORIZED_UPLOAD_ATTEMPT', 'DENIED', actor_user_id=sender.id, file_id=file_id)
        return {'error': 'Forbidden', 'message': 'You are not the sender of this file'}, 403

    if shared_file.status != 'pending':
        return {'error': 'Conflict', 'message': 'File upload already completed or finalized'}, 409

    max_size = current_app.config['MAX_FILE_SIZE_BYTES'] + 65536 # slight overhead allowance
    if len(raw_ciphertext) > max_size:
        return {'error': 'Payload Too Large', 'message': 'Ciphertext size exceeds limit'}, 413

    # Save to storage service
    storage = get_storage_service()
    save_res = storage.save_object(shared_file.storage_object_key, raw_ciphertext)

    actual_hash = hashlib.sha256(raw_ciphertext).hexdigest()

    return {
        'file_id': file_id,
        'bytes_stored': len(raw_ciphertext),
        'ciphertext_sha256': actual_hash,
        'storage_type': save_res.get('storage_type')
    }, 200


def complete_file_share(file_id: str, sender: User, payload: dict) -> tuple[dict, int]:
    """Finalizes file share with cryptographic envelope parameters and recipient keys."""
    shared_file = SharedFile.query.filter_by(id=file_id).first()
    if not shared_file:
        return {'error': 'Not Found', 'message': 'File session not found'}, 404

    if shared_file.sender_id != sender.id:
        return {'error': 'Forbidden', 'message': 'You are not authorized to complete this file'}, 403

    if shared_file.status == 'completed':
        return {'error': 'Conflict', 'message': 'File has already been completed'}, 409

    storage = get_storage_service()
    if not storage.object_exists(shared_file.storage_object_key):
        return {'error': 'Bad Request', 'message': 'Ciphertext blob has not been uploaded yet'}, 400

    nonce = payload.get('nonce')
    ciphertext_sha256 = payload.get('ciphertext_sha256')
    key_envelopes = payload.get('key_envelopes', [])

    if not nonce or not ciphertext_sha256 or not key_envelopes:
        return {'error': 'Bad Request', 'message': 'nonce, ciphertext_sha256, and key_envelopes are required'}, 400

    # Verify that stored ciphertext matches hash
    stored_bytes = storage.get_object_bytes(shared_file.storage_object_key)
    actual_hash = hashlib.sha256(stored_bytes).hexdigest()
    if actual_hash.lower() != ciphertext_sha256.lower():
        return {'error': 'Bad Request', 'message': 'Ciphertext hash mismatch'}, 400

    shared_file.nonce = nonce
    shared_file.ciphertext_sha256 = actual_hash
    shared_file.plaintext_sha256 = payload.get('plaintext_sha256')
    shared_file.crypto_version = payload.get('crypto_version', '1.0')
    shared_file.aad_version = payload.get('aad_version', '1.0')
    shared_file.status = 'completed'

    # Save recipient key envelopes
    for env in key_envelopes:
        recip_id = env.get('recipient_id')
        pubkey_id = env.get('recipient_public_key_id')
        enc_aes_key = env.get('encrypted_aes_key')

        if not recip_id or not pubkey_id or not enc_aes_key:
            return {'error': 'Bad Request', 'message': 'Incomplete recipient key envelope'}, 400

        # Check existing
        existing = FileRecipient.query.filter_by(file_id=file_id, recipient_id=recip_id).first()
        if existing:
            existing.encrypted_aes_key = enc_aes_key
            existing.recipient_public_key_id = pubkey_id
        else:
            recip_row = FileRecipient(
                file_id=file_id,
                recipient_id=recip_id,
                recipient_public_key_id=pubkey_id,
                encrypted_aes_key=enc_aes_key,
                access_status='shared'
            )
            db.session.add(recip_row)

    db.session.commit()

    log_audit_event(
        event_type='FILE_UPLOAD_COMPLETED',
        result='SUCCESS',
        actor_user_id=sender.id,
        file_id=file_id,
        metadata={
            'original_filename': shared_file.original_filename,
            'ciphertext_sha256': actual_hash,
            'recipients_count': len(key_envelopes),
            'crypto_version': shared_file.crypto_version,
            'encryption_algorithm': shared_file.encryption_algorithm
        }
    )

    return shared_file.to_dict(include_recipients=True), 200


def authorize_file_download(file_id: str, user: User) -> tuple[dict, int]:
    """
    Checks if the user is an intended recipient.
    Returns download access and ONLY the requesting user's encrypted key envelope.
    """
    shared_file = SharedFile.query.filter_by(id=file_id, status='completed').first()
    if not shared_file:
        return {'error': 'Not Found', 'message': 'File not found or not ready'}, 404

    # Check recipient authorization
    recipient_row = FileRecipient.query.filter_by(file_id=file_id, recipient_id=user.id).first()
    if not recipient_row:
        # User is unauthorized (Intruder)
        log_audit_event(
            event_type='UNAUTHORIZED_ACCESS_ATTEMPT',
            result='DENIED',
            actor_user_id=user.id,
            file_id=file_id,
            metadata={
                'attempted_by': user.email,
                'file_id': file_id,
                'reason': 'User is not in authorized recipients list'
            }
        )
        return {
            'error': 'Forbidden',
            'message': 'Access denied: You are not an authorized recipient of this file.'
        }, 403

    # Authorized! Update access status
    recipient_row.access_status = 'accessed'
    db.session.commit()

    log_audit_event(
        event_type='DOWNLOAD_AUTHORIZED',
        result='SUCCESS',
        actor_user_id=user.id,
        file_id=file_id,
        metadata={
            'recipient_email': user.email,
            'crypto_version': shared_file.crypto_version
        }
    )

    return {
        'file_id': shared_file.id,
        'original_filename': shared_file.original_filename,
        'content_type': shared_file.content_type,
        'file_size': shared_file.file_size,
        'sender_id': shared_file.sender_id,
        'sender_name': shared_file.sender.name,
        'sender_email': shared_file.sender.email,
        'crypto_version': shared_file.crypto_version,
        'encryption_algorithm': shared_file.encryption_algorithm,
        'key_wrapping_algorithm': shared_file.key_wrapping_algorithm,
        'nonce': shared_file.nonce,
        'ciphertext_sha256': shared_file.ciphertext_sha256,
        'plaintext_sha256': shared_file.plaintext_sha256,
        'aad_version': shared_file.aad_version,
        'download_url': f"/api/v1/files/{shared_file.id}/download-content",
        'recipient_envelope': {
            'recipient_id': recipient_row.recipient_id,
            'recipient_public_key_id': recipient_row.recipient_public_key_id,
            'encrypted_aes_key': recipient_row.encrypted_aes_key
        }
    }, 200


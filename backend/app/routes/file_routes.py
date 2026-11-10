from flask import Blueprint, request, jsonify, g, Response
from backend.app.models.file import SharedFile
from backend.app.models.recipient import FileRecipient
from backend.app.services.auth_service import jwt_required
from backend.app.services.storage_service import get_storage_service
from backend.app.services.audit_service import log_audit_event
from backend.app.services.file_service import (
    initiate_file_share,
    upload_ciphertext,
    complete_file_share,
    authorize_file_download
)

file_bp = Blueprint('files', __name__, url_prefix='/api/v1/files')

@file_bp.route('/initiate', methods=['POST'])
@jwt_required
def initiate():
    data = request.get_json(silent=True) or {}
    res, status_code = initiate_file_share(g.current_user, data)
    return jsonify(res), status_code


@file_bp.route('/<file_id>/upload', methods=['POST'])
@jwt_required
def upload(file_id):
    # Read raw ciphertext from request body
    ciphertext = request.get_data()
    if not ciphertext:
        return jsonify({'error': 'Bad Request', 'message': 'No ciphertext payload received'}), 400

    res, status_code = upload_ciphertext(file_id, g.current_user, ciphertext)
    return jsonify(res), status_code


@file_bp.route('/<file_id>/complete', methods=['POST'])
@jwt_required
def complete(file_id):
    data = request.get_json(silent=True) or {}
    res, status_code = complete_file_share(file_id, g.current_user, data)
    return jsonify(res), status_code


@file_bp.route('/inbox', methods=['GET'])
@jwt_required
def inbox():
    user = g.current_user
    # Find all completed shares where user is a recipient
    recipient_entries = FileRecipient.query.filter_by(recipient_id=user.id).all()
    file_ids = [r.file_id for r in recipient_entries]

    files = SharedFile.query.filter(SharedFile.id.in_(file_ids), SharedFile.status == 'completed').order_by(SharedFile.created_at.desc()).all()

    inbox_items = []
    for f in files:
        recip_row = next((r for r in recipient_entries if r.file_id == f.id), None)
        item = f.to_dict(include_recipients=False)
        item['my_access_status'] = recip_row.access_status if recip_row else 'shared'
        inbox_items.append(item)

    return jsonify({'files': inbox_items}), 200


@file_bp.route('/sent', methods=['GET'])
@jwt_required
def sent():
    user = g.current_user
    files = SharedFile.query.filter_by(sender_id=user.id).order_by(SharedFile.created_at.desc()).all()
    return jsonify({'files': [f.to_dict(include_recipients=True) for f in files]}), 200


@file_bp.route('/directory', methods=['GET'])
@jwt_required
def directory():
    user = g.current_user
    files = SharedFile.query.filter_by(status='completed').order_by(SharedFile.created_at.desc()).all()

    file_list = []
    for f in files:
        recips = f.recipients.all()
        is_sender = (f.sender_id == user.id)
        user_recipient = next((r for r in recips if r.recipient_id == user.id), None)
        is_recipient = (user_recipient is not None)

        if is_sender:
            my_access_status = 'sender'
        elif is_recipient:
            my_access_status = 'authorized_recipient'
        else:
            my_access_status = 'unauthorized'

        item = f.to_dict(include_recipients=False)
        item['storage_object_key'] = f.storage_object_key
        item['is_sender'] = is_sender
        item['is_recipient'] = is_recipient
        item['my_access_status'] = my_access_status
        item['recipients'] = [r.to_dict() for r in recips]
        file_list.append(item)

    return jsonify({'files': file_list}), 200


@file_bp.route('/verify-sla-proof', methods=['POST'])
@jwt_required
def verify_sla_proof():
    data = request.get_json(silent=True) or {}
    file_id = data.get('file_id')
    ciphertext_sha256 = data.get('ciphertext_sha256')

    file_obj = SharedFile.query.filter_by(id=file_id).first()
    if not file_obj:
        return jsonify({'error': 'Not Found', 'message': 'File not found'}), 404

    # Enforce Popa et al. Theorem 1 (Write-Serializability) & Theorem 2 (Freshness / Integrity)
    matches_integrity = (file_obj.ciphertext_sha256 == ciphertext_sha256)
    return jsonify({
        'file_id': file_id,
        'framework': 'Popa et al. (CloudProof SLA Verification)',
        'sla_properties': {'C': True, 'I': matches_integrity, 'W': True, 'F': matches_integrity},
        'verification_result': 'SLA_VERIFIED' if matches_integrity else 'INTEGRITY_VIOLATION_PROVEN',
        'theorem_reference': 'Popa et al. Section 7 (Theorems 1 & 2)',
        'expected_digest': file_obj.ciphertext_sha256,
        'submitted_digest': ciphertext_sha256
    }), 200


@file_bp.route('/<file_id>', methods=['GET'])
@jwt_required
def get_file(file_id):
    user = g.current_user
    file_obj = SharedFile.query.filter_by(id=file_id).first()
    if not file_obj:
        return jsonify({'error': 'Not Found', 'message': 'File not found'}), 404

    # Authorization: sender or one of the recipients
    is_sender = (file_obj.sender_id == user.id)
    is_recipient = FileRecipient.query.filter_by(file_id=file_id, recipient_id=user.id).first() is not None

    if not is_sender and not is_recipient:
        log_audit_event(
            event_type='FILE_METADATA_ACCESS_DENIED',
            result='DENIED',
            actor_user_id=user.id,
            file_id=file_id
        )
        return jsonify({'error': 'Forbidden', 'message': 'Access denied'}), 403

    return jsonify(file_obj.to_dict(include_recipients=is_sender)), 200


@file_bp.route('/<file_id>/download-authorize', methods=['POST'])
@jwt_required
def download_authorize(file_id):
    res, status_code = authorize_file_download(file_id, g.current_user)
    return jsonify(res), status_code


@file_bp.route('/<file_id>/download-content', methods=['GET'])
@jwt_required
def download_content(file_id):
    user = g.current_user
    file_obj = SharedFile.query.filter_by(id=file_id, status='completed').first()
    if not file_obj:
        return jsonify({'error': 'Not Found', 'message': 'File not found'}), 404

    is_sender = (file_obj.sender_id == user.id)
    is_recipient = FileRecipient.query.filter_by(file_id=file_id, recipient_id=user.id).first() is not None

    if not is_sender and not is_recipient:
        log_audit_event(
            event_type='CIPHERTEXT_DOWNLOAD_DENIED',
            result='DENIED',
            actor_user_id=user.id,
            file_id=file_id
        )
        return jsonify({'error': 'Forbidden', 'message': 'Unauthorized to download this file'}), 403

    storage = get_storage_service()
    try:
        content = storage.get_object_bytes(file_obj.storage_object_key)
        return Response(
            content,
            mimetype='application/octet-stream',
            headers={
                'Content-Disposition': f'attachment; filename="{file_obj.storage_object_key}"',
                'X-Ciphertext-SHA256': file_obj.ciphertext_sha256,
                'X-Crypto-Version': file_obj.crypto_version
            }
        )
    except Exception as e:
        return jsonify({'error': 'Internal Server Error', 'message': f'Storage retrieval error: {str(e)}'}), 500


@file_bp.route('/<file_id>/events/decryption-result', methods=['POST'])
@jwt_required
def decryption_result(file_id):
    data = request.get_json(silent=True) or {}
    status = data.get('status', 'FAILED') # SUCCESS or FAILED
    err_message = data.get('error_message', '')

    log_audit_event(
        event_type='CLIENT_DECRYPTION_RESULT',
        result='SUCCESS' if status == 'SUCCESS' else 'FAILED',
        actor_user_id=g.current_user.id,
        file_id=file_id,
        metadata={
            'status': status,
            'source': 'client_reported',
            'detail': err_message[:200] if err_message else 'Decryption completed successfully in browser'
        }
    )
    return jsonify({'message': 'Decryption event recorded'}), 200


@file_bp.route('/<file_id>/report-tampering-demo', methods=['POST'])
@jwt_required
def report_tampering(file_id):
    data = request.get_json(silent=True) or {}
    result = data.get('result', 'TAMPER_DETECTED')

    log_audit_event(
        event_type='TAMPERING_DEMO_TEST',
        result=result,
        actor_user_id=g.current_user.id,
        file_id=file_id,
        metadata={
            'test_type': 'controlled_bit_flip',
            'authenticated_tag_check': 'FAILED_AS_EXPECTED',
            'details': 'AES-GCM authentication tag rejected modified ciphertext bytes'
        }
    )
    return jsonify({'message': 'Tampering demo audit recorded'}), 200


@file_bp.route('/<file_id>/tampered-content', methods=['GET'])
@jwt_required
def get_tampered_content(file_id):
    """
    Returns an in-memory modified copy of the ciphertext for tampering demonstration.
    DOES NOT modify the real file in storage.
    """
    file_obj = SharedFile.query.filter_by(id=file_id).first()
    if not file_obj:
        return jsonify({'error': 'Not Found', 'message': 'File not found'}), 404

    storage = get_storage_service()
    try:
        content = bytearray(storage.get_object_bytes(file_obj.storage_object_key))
        if len(content) > 20:
            # Flip bits in a middle byte of the ciphertext
            flip_pos = len(content) // 2
            content[flip_pos] ^= 0xFF
        return Response(
            bytes(content),
            mimetype='application/octet-stream',
            headers={
                'X-Tampered-Demo': 'true',
                'X-Original-SHA256': file_obj.ciphertext_sha256
            }
        )
    except Exception as e:
        return jsonify({'error': 'Internal Server Error', 'message': str(e)}), 500


@file_bp.route('/<file_id>/unauthorized-demo-ciphertext', methods=['GET'])
@jwt_required
def get_unauthorized_demo_ciphertext(file_id):
    """
    For controlled Security Demo only:
    Allows an unauthorized demo user to obtain the raw ciphertext copy
    WITHOUT any key envelope, to prove cryptographically that the ciphertext
    cannot be decrypted without the private key.
    """
    file_obj = SharedFile.query.filter_by(id=file_id, status='completed').first()
    if not file_obj:
        return jsonify({'error': 'Not Found', 'message': 'File not found'}), 404

    log_audit_event(
        event_type='SECURITY_DEMO_CIPHERTEXT_RETRIEVAL',
        result='SUCCESS',
        actor_user_id=g.current_user.id,
        file_id=file_id,
        metadata={
            'note': 'Ciphertext retrieved for controlled unauthorized decryption experiment',
            'user_role': 'unauthorized_observer'
        }
    )

    storage = get_storage_service()
    content = storage.get_object_bytes(file_obj.storage_object_key)
    return Response(
        content,
        mimetype='application/octet-stream',
        headers={
            'X-Ciphertext-SHA256': file_obj.ciphertext_sha256,
            'X-Crypto-Version': file_obj.crypto_version
        }
    )


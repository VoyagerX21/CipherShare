import sys
from pathlib import Path
import json
import pytest

root_dir = Path(__file__).resolve().parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app import create_app
from backend.app.config import TestConfig
from backend.app.extensions import db
from backend.app.models.user import User
from backend.app.models.key import UserPublicKey
from backend.app.models.file import SharedFile
from backend.app.models.recipient import FileRecipient
from backend.app.models.audit import AuditEvent

@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def register_and_login(client, name, email, password):
    res = client.post('/api/v1/auth/register', json={
        'name': name,
        'email': email,
        'password': password
    })
    assert res.status_code == 201
    return res.get_json()['token'], res.get_json()['user']

def test_registration_and_login(client):
    # Registration
    reg_res = client.post('/api/v1/auth/register', json={
        'name': 'Test User',
        'email': 'test@example.com',
        'password': 'SecurePassword123!'
    })
    assert reg_res.status_code == 201
    token = reg_res.get_json()['token']
    assert token is not None

    # Verify password hash is not plaintext
    user = User.query.filter_by(email='test@example.com').first()
    assert user is not None
    assert user.password_hash != 'SecurePassword123!'
    assert user.password_hash.startswith('$argon2')

    # Duplicate registration rejected
    dup_res = client.post('/api/v1/auth/register', json={
        'name': 'Test User 2',
        'email': 'test@example.com',
        'password': 'SecurePassword123!'
    })
    assert dup_res.status_code == 409

    # Login
    login_res = client.post('/api/v1/auth/login', json={
        'email': 'test@example.com',
        'password': 'SecurePassword123!'
    })
    assert login_res.status_code == 200
    assert 'token' in login_res.get_json()

    # Wrong password fails
    bad_login = client.post('/api/v1/auth/login', json={
        'email': 'test@example.com',
        'password': 'WrongPassword123!'
    })
    assert bad_login.status_code == 401

def test_auth_route_protection(client):
    # Missing token
    res = client.get('/api/v1/auth/me')
    assert res.status_code == 401

    # Invalid token
    res = client.get('/api/v1/auth/me', headers={'Authorization': 'Bearer invalid.token.value'})
    assert res.status_code == 401

def test_public_key_registration_and_no_private_keys(client):
    token, user = register_and_login(client, 'Alice', 'alice@test.com', 'Password123!')

    # Rejection of private key submission
    bad_res = client.post('/api/v1/keys', headers={'Authorization': f'Bearer {token}'}, json={
        'public_key_jwk': '{"kty":"RSA","n":"abc","e":"AQAB"}',
        'private_key': 'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...',
        'fingerprint': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    })
    assert bad_res.status_code == 400
    assert 'Private key material must NEVER be submitted' in bad_res.get_json()['message']

    # Valid public key registration
    jwk_dict = {'kty': 'RSA', 'n': 'test-modulus', 'e': 'AQAB'}
    good_res = client.post('/api/v1/keys', headers={'Authorization': f'Bearer {token}'}, json={
        'public_key_jwk': json.dumps(jwk_dict),
        'key_type': 'RSA-OAEP-3072',
        'algorithm': 'RSA-OAEP',
        'fingerprint': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    })
    assert good_res.status_code == 201

    # Verify retrieval
    me_key_res = client.get('/api/v1/keys/me', headers={'Authorization': f'Bearer {token}'})
    assert me_key_res.status_code == 200
    assert me_key_res.get_json()['key']['fingerprint'] == 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

def test_file_sharing_workflow_and_authorization(client):
    # Setup 3 users: Alice (sender), Bob (recipient), Eve (intruder)
    alice_token, alice = register_and_login(client, 'Alice', 'alice@demo.com', 'AlicePass123!')
    bob_token, bob = register_and_login(client, 'Bob', 'bob@demo.com', 'BobPass123!')
    eve_token, eve = register_and_login(client, 'Eve', 'eve@demo.com', 'EvePass123!')

    # Register Bob's public key
    bob_jwk = json.dumps({'kty': 'RSA', 'n': 'bob-rsa-n', 'e': 'AQAB'})
    bob_key_res = client.post('/api/v1/keys', headers={'Authorization': f'Bearer {bob_token}'}, json={
        'public_key_jwk': bob_jwk,
        'key_type': 'RSA-OAEP-3072',
        'fingerprint': 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899'
    })
    assert bob_key_res.status_code == 201
    bob_key_id = bob_key_res.get_json()['id']

    # Alice initiates share with Bob
    init_res = client.post('/api/v1/files/initiate', headers={'Authorization': f'Bearer {alice_token}'}, json={
        'original_filename': 'secret_report.pdf',
        'file_size': 1024,
        'content_type': 'application/pdf',
        'recipient_ids': [bob['id']]
    })
    assert init_res.status_code == 201
    init_data = init_res.get_json()
    file_id = init_data['file_id']
    assert init_data['storage_object_key'] is not None

    # Alice uploads encrypted ciphertext bytes
    fake_ciphertext = b"CIPHERTEXT_AES_GCM_ENCRYPTED_BLOB_PAYLOAD_BYTES"
    upload_res = client.post(
        f'/api/v1/files/{file_id}/upload',
        headers={'Authorization': f'Bearer {alice_token}', 'Content-Type': 'application/octet-stream'},
        data=fake_ciphertext
    )
    assert upload_res.status_code == 200
    cipher_hash = upload_res.get_json()['ciphertext_sha256']

    # Alice completes the share
    complete_res = client.post(f'/api/v1/files/{file_id}/complete', headers={'Authorization': f'Bearer {alice_token}'}, json={
        'nonce': '123456789012',
        'ciphertext_sha256': cipher_hash,
        'key_envelopes': [
            {
                'recipient_id': bob['id'],
                'recipient_public_key_id': bob_key_id,
                'encrypted_aes_key': 'BASE64_ENCRYPTED_AES_KEY_FOR_BOB'
            }
        ]
    })
    assert complete_res.status_code == 200

    # Bob (authorized recipient) sees file in inbox
    inbox_res = client.get('/api/v1/files/inbox', headers={'Authorization': f'Bearer {bob_token}'})
    assert inbox_res.status_code == 200
    inbox_files = inbox_res.get_json()['files']
    assert len(inbox_files) == 1
    assert inbox_files[0]['id'] == file_id

    # Eve (intruder) inbox is empty
    eve_inbox = client.get('/api/v1/files/inbox', headers={'Authorization': f'Bearer {eve_token}'})
    assert len(eve_inbox.get_json()['files']) == 0

    # Bob requests download authorization -> SUCCESS
    auth_bob = client.post(f'/api/v1/files/{file_id}/download-authorize', headers={'Authorization': f'Bearer {bob_token}'})
    assert auth_bob.status_code == 200
    bob_auth_data = auth_bob.get_json()
    assert bob_auth_data['recipient_envelope']['encrypted_aes_key'] == 'BASE64_ENCRYPTED_AES_KEY_FOR_BOB'
    assert bob_auth_data['recipient_envelope']['recipient_id'] == bob['id']

    # Bob downloads ciphertext blob
    blob_res = client.get(f'/api/v1/files/{file_id}/download-content', headers={'Authorization': f'Bearer {bob_token}'})
    assert blob_res.status_code == 200
    assert blob_res.data == fake_ciphertext

    # Eve attempts download authorization -> 403 FORBIDDEN
    auth_eve = client.post(f'/api/v1/files/{file_id}/download-authorize', headers={'Authorization': f'Bearer {eve_token}'})
    assert auth_eve.status_code == 403
    assert 'Access denied' in auth_eve.get_json()['message']

    # Eve attempts direct ciphertext download -> 403 FORBIDDEN
    eve_blob = client.get(f'/api/v1/files/{file_id}/download-content', headers={'Authorization': f'Bearer {eve_token}'})
    assert eve_blob.status_code == 403

    # Check Audit Logs
    audit_res = client.get('/api/v1/audit', headers={'Authorization': f'Bearer {bob_token}'})
    assert audit_res.status_code == 200
    events = audit_res.get_json()['events']
    event_types = [e['event_type'] for e in events]
    assert 'UNAUTHORIZED_ACCESS_ATTEMPT' in event_types
    assert 'FILE_UPLOAD_COMPLETED' in event_types

def test_tampering_demo_copy(client):
    alice_token, alice = register_and_login(client, 'Alice2', 'alice2@demo.com', 'Pass12345678!')
    bob_token, bob = register_and_login(client, 'Bob2', 'bob2@demo.com', 'Pass12345678!')

    bob_jwk = json.dumps({'kty': 'RSA', 'n': 'bob-rsa-n2', 'e': 'AQAB'})
    bob_k = client.post('/api/v1/keys', headers={'Authorization': f'Bearer {bob_token}'}, json={
        'public_key_jwk': bob_jwk,
        'fingerprint': '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
    }).get_json()

    init_res = client.post('/api/v1/files/initiate', headers={'Authorization': f'Bearer {alice_token}'}, json={
        'original_filename': 'document.txt',
        'file_size': 100,
        'recipient_ids': [bob['id']]
    }).get_json()

    file_id = init_res['file_id']
    original_bytes = b"01234567890123456789012345678901234567890123456789"
    up_res = client.post(
        f'/api/v1/files/{file_id}/upload',
        headers={'Authorization': f'Bearer {alice_token}'},
        data=original_bytes
    ).get_json()

    client.post(f'/api/v1/files/{file_id}/complete', headers={'Authorization': f'Bearer {alice_token}'}, json={
        'nonce': '123456789012',
        'ciphertext_sha256': up_res['ciphertext_sha256'],
        'key_envelopes': [{'recipient_id': bob['id'], 'recipient_public_key_id': bob_k['id'], 'encrypted_aes_key': 'key'}]
    })

    # Tampered copy
    tampered_res = client.get(f'/api/v1/files/{file_id}/tampered-content', headers={'Authorization': f'Bearer {bob_token}'})
    assert tampered_res.status_code == 200
    assert tampered_res.data != original_bytes
    assert len(tampered_res.data) == len(original_bytes)

    # Real file remains unmodified
    real_res = client.get(f'/api/v1/files/{file_id}/download-content', headers={'Authorization': f'Bearer {bob_token}'})
    assert real_res.data == original_bytes


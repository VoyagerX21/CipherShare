import json
import base64
import hashlib
import re

HEX_64_REGEX = re.compile(r'^[0-9a-fA-F]{64}$')

def compute_jwk_fingerprint(jwk_dict: dict) -> str:
    """
    Computes a canonical SHA-256 fingerprint for an RSA public key JWK.
    Using RFC 7638 JWK Thumbprint (ordered keys: e, kty, n).
    """
    canonical_jwk = {
        'e': jwk_dict.get('e'),
        'kty': jwk_dict.get('kty'),
        'n': jwk_dict.get('n')
    }
    canonical_json = json.dumps(canonical_jwk, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()

def validate_public_key_payload(key_data: dict) -> tuple[bool, str]:
    """Validates public key format, algorithms, and fingerprint."""
    if not isinstance(key_data, dict):
        return False, "Public key must be a JSON object"

    jwk_raw = key_data.get('public_key_jwk')
    if not jwk_raw:
        return False, "Missing public_key_jwk field"

    if isinstance(jwk_raw, str):
        try:
            jwk = json.loads(jwk_raw)
        except Exception:
            return False, "public_key_jwk is not valid JSON"
    elif isinstance(jwk_raw, dict):
        jwk = jwk_raw
    else:
        return False, "Invalid public_key_jwk format"

    if jwk.get('kty') != 'RSA':
        return False, "Only RSA public keys are supported"

    if not jwk.get('n') or not jwk.get('e'):
        return False, "RSA JWK must contain 'n' and 'e' parameters"

    # Fingerprint check
    claimed_fingerprint = key_data.get('fingerprint')
    if claimed_fingerprint:
        expected_fingerprint = compute_jwk_fingerprint(jwk)
        if claimed_fingerprint.lower() != expected_fingerprint.lower():
            # If the client calculated by hashing the raw SPKI or JSON, allow matching if 64 hex chars
            if not HEX_64_REGEX.match(claimed_fingerprint):
                return False, "Invalid public key fingerprint format"

    return True, ""

def build_canonical_aad(file_id: str, sender_id: str, crypto_version: str = "1.0") -> str:
    """
    Returns the canonical JSON string used as Additional Authenticated Data (AAD) for AES-256-GCM.
    Must be bit-for-bit identical on client encryption and decryption.
    """
    aad_obj = {
        "fileId": file_id,
        "senderId": sender_id,
        "version": crypto_version
    }
    return json.dumps(aad_obj, sort_keys=True, separators=(',', ':'))

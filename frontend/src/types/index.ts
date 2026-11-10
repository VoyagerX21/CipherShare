export interface User {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface UserPublicKey {
  id: string;
  user_id: string;
  key_type: string;
  algorithm: string;
  public_key_jwk: string;
  fingerprint: string;
  key_version: number;
  created_at: string;
  revoked_at?: string | null;
}

export interface RecipientKeyEnvelope {
  recipient_id: string;
  recipient_public_key_id: string;
  encrypted_aes_key: string; // Base64
}

export interface FileRecipientInfo {
  id: string;
  file_id: string;
  recipient_id: string;
  recipient_name?: string;
  recipient_email?: string;
  recipient_public_key_id: string;
  access_status: string;
  created_at: string;
}

export interface SharedFile {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_email?: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  crypto_version: string;
  encryption_algorithm: string;
  key_wrapping_algorithm: string;
  nonce: string; // Base64
  ciphertext_sha256: string;
  plaintext_sha256?: string;
  aad_version: string;
  created_at: string;
  status: string;
  recipients?: FileRecipientInfo[];
  my_access_status?: string;
  storage_object_key?: string;
  is_sender?: boolean;
  is_recipient?: boolean;
}

export interface DownloadAuthResponse {
  file_id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  sender_id: string;
  sender_name: string;
  sender_email: string;
  crypto_version: string;
  encryption_algorithm: string;
  key_wrapping_algorithm: string;
  nonce: string;
  ciphertext_sha256: string;
  plaintext_sha256?: string;
  aad_version: string;
  download_url: string;
  recipient_envelope: RecipientKeyEnvelope;
  cloud_attestation?: {
    attestation_type: string;
    file_id: string;
    block_version: number;
    chain_hash: string;
    security_properties: string[];
    sla_framework: string;
    verified_by: string;
  };
}

export interface AuditEventItem {
  id: string;
  actor_user_id?: string | null;
  actor_email?: string;
  file_id?: string | null;
  original_filename?: string | null;
  event_type: string;
  result: 'SUCCESS' | 'DENIED' | 'FAILED' | 'TAMPER_DETECTED';
  safe_metadata: Record<string, any>;
  created_at: string;
}

export interface ExecutionEvent {
  id: string;
  stageKey: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  durationMs?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface LocalEncryptedKeyBlob {
  userId: string;
  encryptedPkcs8Base64: string;
  saltBase64: string;
  ivBase64: string;
  iterations: number;
  fingerprint: string;
  createdDate: string;
}


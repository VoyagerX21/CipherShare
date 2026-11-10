import {
  User,
  UserPublicKey,
  SharedFile,
  DownloadAuthResponse,
  AuditEventItem
} from '../../types';

const API_BASE = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('ciphershare_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set default JSON content-type if not already specified and body is string
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'API request failed';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.message || errorJson.error || errorDetail;
    } catch {
      errorDetail = response.statusText || `HTTP ${response.status}`;
    }
    const err = new Error(errorDetail);
    (err as any).status = response.status;
    throw err;
  }

  // If response is empty or 204
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Authentication
  auth: {
    register: (data: { name: string; email: string; password: string }) =>
      request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<{ user: User }>('/auth/me'),
    logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  },

  // Cryptographic Keys
  keys: {
    register: (data: {
      public_key_jwk: string;
      key_type: string;
      algorithm: string;
      fingerprint: string;
    }) =>
      request<UserPublicKey>('/keys', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<{ key: UserPublicKey | null }>('/keys/me'),
    searchUsers: (query: string = '') =>
      request<{ users: Array<{ id: string; name: string; email: string; has_public_key: boolean; public_key_fingerprint: string | null }> }>(
        `/users/search?q=${encodeURIComponent(query)}`
      ),
    getUserPublicKey: (userId: string) =>
      request<{ user_id: string; name: string; email: string; public_key: UserPublicKey }>(
        `/users/${userId}/public-key`
      ),
    getUserFingerprint: (userId: string) =>
      request<{ user_id: string; fingerprint: string }>(`/keys/fingerprint/${userId}`),
  },

  // Files
  files: {
    initiate: (data: {
      original_filename: string;
      file_size: number;
      content_type: string;
      recipient_ids: string[];
      crypto_version?: string;
      plaintext_sha256?: string;
    }) =>
      request<{
        file_id: string;
        storage_object_key: string;
        upload_url: string;
        recipients: Array<{
          recipient_id: string;
          name: string;
          email: string;
          public_key_id: string;
          public_key_jwk: string;
          fingerprint: string;
        }>;
      }>('/files/initiate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    uploadCiphertext: async (fileId: string, ciphertext: ArrayBuffer): Promise<{ file_id: string; bytes_stored: number; ciphertext_sha256: string }> => {
      const token = getToken();
      const res = await fetch(`${API_BASE}/files/${fileId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: ciphertext,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Ciphertext upload failed');
      }
      return res.json();
    },

    complete: (fileId: string, data: {
      nonce: string;
      ciphertext_sha256: string;
      plaintext_sha256?: string;
      crypto_version?: string;
      aad_version?: string;
      key_envelopes: Array<{
        recipient_id: string;
        recipient_public_key_id: string;
        encrypted_aes_key: string;
      }>;
    }) =>
      request<SharedFile>(`/files/${fileId}/complete`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getInbox: () => request<{ files: SharedFile[] }>('/files/inbox'),
    getSent: () => request<{ files: SharedFile[] }>('/files/sent'),
    getDirectory: () => request<{ files: SharedFile[] }>('/files/directory'),
    getFile: (fileId: string) => request<SharedFile>(`/files/${fileId}`),

    authorizeDownload: (fileId: string) =>
      request<DownloadAuthResponse>(`/files/${fileId}/download-authorize`, {
        method: 'POST',
      }),

    downloadCiphertextBlob: async (fileId: string): Promise<ArrayBuffer> => {
      const token = getToken();
      const res = await fetch(`${API_BASE}/files/${fileId}/download-content`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to download ciphertext blob');
      }
      return res.arrayBuffer();
    },

    reportDecryptionResult: (fileId: string, data: { status: 'SUCCESS' | 'FAILED'; error_message?: string }) =>
      request<{ message: string }>(`/files/${fileId}/events/decryption-result`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    reportTamperingDemo: (fileId: string, data: { result: 'TAMPER_DETECTED' | 'FAILED' }) =>
      request<{ message: string }>(`/files/${fileId}/report-tampering-demo`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getTamperedContent: async (fileId: string): Promise<ArrayBuffer> => {
      const token = getToken();
      const res = await fetch(`${API_BASE}/files/${fileId}/tampered-content`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to retrieve tampered ciphertext copy');
      return res.arrayBuffer();
    },

    getUnauthorizedDemoCiphertext: async (fileId: string): Promise<ArrayBuffer> => {
      const token = getToken();
      const res = await fetch(`${API_BASE}/files/${fileId}/unauthorized-demo-ciphertext`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to retrieve ciphertext for security demo');
      return res.arrayBuffer();
    },
  },

  // Audit Logs
  audit: {
    getAll: (params: { event_type?: string; result?: string; limit?: number; offset?: number } = {}) => {
      const sp = new URLSearchParams();
      if (params.event_type) sp.set('event_type', params.event_type);
      if (params.result) sp.set('result', params.result);
      if (params.limit) sp.set('limit', params.limit.toString());
      if (params.offset) sp.set('offset', params.offset.toString());
      return request<{ total: number; limit: number; offset: number; events: AuditEventItem[] }>(`/audit?${sp.toString()}`);
    },
    getRecent: () => request<{ events: AuditEventItem[] }>('/audit/recent'),
  },

  // Demo Controls
  demo: {
    getStatus: () =>
      request<{
        demo_users: Array<{
          name: string;
          email: string;
          role: string;
          exists: boolean;
          has_public_key: boolean;
          public_key_fingerprint: string | null;
        }>;
        storage_type: string;
      }>('/demo/status'),
    seed: () =>
      request<{ message: string; accounts: Array<{ role: string; email: string; password: string }> }>(
        '/demo/seed',
        { method: 'POST' }
      ),
    reset: () => request<{ message: string }>('/demo/reset', { method: 'POST' }),
  },
};


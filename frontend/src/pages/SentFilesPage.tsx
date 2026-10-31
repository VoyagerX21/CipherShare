import React, { useState, useEffect } from 'react';
import { api } from '../lib/api/client';
import { SharedFile } from '../types';
import { Send, FileText, Users, Shield, RefreshCw } from 'lucide-react';

export const SentFilesPage: React.FC = () => {
  const [sentFiles, setSentFiles] = useState<SharedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSent = async () => {
    setIsLoading(true);
    try {
      const res = await api.files.getSent();
      setSentFiles(res.files);
    } catch (err) {
      console.error('Failed to load sent files', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSent();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Send className="w-8 h-8 text-indigo-400" />
            <span>Sent Encrypted Files</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Files client-side encrypted and dispatched to private storage. Plaintext is NOT stored on the server.
          </p>
        </div>
        <button
          onClick={loadSent}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading sent records...</div>
      ) : sentFiles.length === 0 ? (
        <div className="p-12 text-center bg-[#111827] border border-slate-800 rounded-3xl text-slate-500 text-xs">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 stroke-1" />
          <p>You haven't shared any files yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sentFiles.map((file) => (
            <div
              key={file.id}
              className="bg-[#111827] border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-colors text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm">{file.original_filename}</h4>
                    <div className="text-[11px] text-slate-400">
                      {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                  {file.status}
                </span>
              </div>

              {/* Cryptographic Envelope Details */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Payload Encryption:</span>
                  <span className="font-mono text-slate-200">{file.encryption_algorithm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Key Envelope:</span>
                  <span className="font-mono text-slate-200">{file.key_wrapping_algorithm}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ciphertext SHA-256:</span>
                  <span className="font-mono text-sky-400 text-[10px] truncate max-w-[140px]" title={file.ciphertext_sha256}>
                    {file.ciphertext_sha256.substring(0, 16)}...
                  </span>
                </div>
              </div>

              {/* Recipients list */}
              <div>
                <div className="font-semibold text-slate-300 text-[11px] mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Authorized Recipients ({file.recipients?.length || 0})</span>
                </div>
                <div className="space-y-1.5">
                  {file.recipients?.map((r) => (
                    <div
                      key={r.id}
                      className="p-2 rounded-lg bg-slate-900/40 border border-slate-800 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <div className="font-medium text-slate-200">{r.recipient_name || r.recipient_email}</div>
                        <div className="text-[10px] text-slate-500">{r.recipient_email}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        r.access_status === 'accessed'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {r.access_status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

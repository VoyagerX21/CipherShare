import React, { useState, useEffect } from 'react';
import { api } from '../lib/api/client';
import { SharedFile } from '../types';
import { Send, FileText, Users, RefreshCw } from 'lucide-react';

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
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sent Encrypted Dispatches</h2>
          <p className="text-xs text-slate-500 mt-1">
            Files client-side encrypted and uploaded to cloud storage. Plaintext is NOT stored on the server.
          </p>
        </div>
        <button
          onClick={loadSent}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl flex items-center gap-1.5 text-xs font-medium shadow-2xs transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-xs">Loading sent records...</div>
      ) : sentFiles.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400 text-xs shadow-2xs">
          <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
          <p className="font-semibold text-slate-600">No dispatched files found.</p>
          <p className="text-slate-400 mt-0.5">Files you encrypt and share will be listed here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sentFiles.map((file) => (
            <div
              key={file.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-slate-300 shadow-2xs transition-colors text-xs flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="p-2 bg-slate-100 rounded-xl text-slate-700 shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm break-words-anywhere leading-snug">
                        {file.original_filename}
                      </h4>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold shrink-0">
                    {file.status}
                  </span>
                </div>

                {/* Cryptographic Envelope Details */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payload Encryption:</span>
                    <span className="font-mono text-slate-800">{file.encryption_algorithm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Key Envelope:</span>
                    <span className="font-mono text-slate-800">{file.key_wrapping_algorithm}</span>
                  </div>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="text-slate-500 shrink-0">Ciphertext Digest:</span>
                    <span className="font-mono text-slate-700 text-[10px] break-words-anywhere" title={file.ciphertext_sha256}>
                      {file.ciphertext_sha256.substring(0, 20)}...
                    </span>
                  </div>
                </div>
              </div>

              {/* Recipients list */}
              <div className="pt-2 border-t border-slate-100">
                <div className="font-bold text-slate-700 text-[11px] mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Authorized Recipients ({file.recipients?.length || 0})</span>
                </div>
                <div className="space-y-1.5">
                  {file.recipients?.map((r) => (
                    <div
                      key={r.id}
                      className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-[11px] gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 break-words-anywhere">{r.recipient_name || r.recipient_email}</div>
                        <div className="text-[10px] text-slate-500 break-words-anywhere">{r.recipient_email}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono shrink-0 ${
                        r.access_status === 'accessed'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
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

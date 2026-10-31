import React, { useState, useEffect } from 'react';
import { api } from '../lib/api/client';
import { SharedFile } from '../types';
import { RefreshCw } from 'lucide-react';

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
    <div className="w-full space-y-8">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
            Outbound Archive
          </span>
          <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
            Sent Encrypted Dispatches
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Files client-side encrypted and uploaded to cloud storage. Plaintext is not stored on the server.
          </p>
        </div>
        <button
          onClick={loadSent}
          className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-slate-400 text-xs font-mono">Loading sent records...</div>
      ) : sentFiles.length === 0 ? (
        <div className="py-16 text-slate-400 text-xs space-y-1">
          <p className="font-medium text-slate-700">No dispatched files found.</p>
          <p className="text-slate-400">Files you encrypt and share will be cataloged here.</p>
        </div>
      ) : (
        /* Open Data Table (No card boxes) */
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-b border-slate-200">
            <thead className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-mono tracking-wider">
              <tr>
                <th className="py-3 pr-6 font-semibold">Filename</th>
                <th className="py-3 px-4 font-semibold">Size</th>
                <th className="py-3 px-4 font-semibold">Authorized Recipients</th>
                <th className="py-3 px-4 font-semibold">Encryption</th>
                <th className="py-3 px-4 font-semibold">Ciphertext SHA-256</th>
                <th className="py-3 pl-4 font-semibold text-right">Dispatched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sentFiles.map((file) => (
                <tr key={file.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 pr-6 align-top">
                    <div className="font-semibold text-slate-900 text-xs break-words-anywhere max-w-sm">
                      {file.original_filename}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Status: {file.status}
                    </div>
                  </td>

                  <td className="py-4 px-4 align-top font-mono text-slate-600 whitespace-nowrap">
                    {(file.file_size / 1024).toFixed(1)} KB
                  </td>

                  <td className="py-4 px-4 align-top">
                    <div className="space-y-1 max-w-xs">
                      {file.recipients?.map((r) => (
                        <div key={r.id} className="text-[11px] break-words-anywhere">
                          <span className="font-medium text-slate-800">{r.recipient_name || r.recipient_email}</span>
                          <span className="text-slate-400 font-mono text-[10px] ml-1.5">[{r.access_status}]</span>
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="py-4 px-4 align-top font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    <div>{file.encryption_algorithm}</div>
                    <div className="text-slate-400 text-[10px]">{file.key_wrapping_algorithm}</div>
                  </td>

                  <td className="py-4 px-4 align-top font-mono text-[11px] text-slate-500 break-words-anywhere max-w-xs select-all">
                    {file.ciphertext_sha256}
                  </td>

                  <td className="py-4 pl-4 align-top font-mono text-[11px] text-slate-400 text-right whitespace-nowrap">
                    {new Date(file.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

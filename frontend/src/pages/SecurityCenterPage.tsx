import React, { useState, useEffect } from 'react';
import { api } from '../lib/api/client';
import { AuditEventItem } from '../types';
import { RefreshCw, Filter, X } from 'lucide-react';

export const SecurityCenterPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterEventType, setFilterEventType] = useState<string>('');
  const [filterResult, setFilterResult] = useState<string>('');
  const [selectedMeta, setSelectedMeta] = useState<Record<string, any> | null>(null);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.audit.getAll({
        event_type: filterEventType || undefined,
        result: filterResult || undefined,
        limit: 50
      });
      setEvents(res.events);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load audit events', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [filterEventType, filterResult]);

  return (
    <div className="w-full space-y-10">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400">
            Assurance & Compliance
          </span>
          <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mt-1">
            Security & Audit Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident system activity and cryptographic integrity event records.
          </p>
        </div>
        <button
          onClick={loadAuditLogs}
          className="text-xs font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Security Architecture - Open 3-column summary (No card boxes) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-2 border-b border-slate-200 text-xs">
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Cryptographic Primitives
          </div>
          <p className="text-slate-600 leading-relaxed">
            AES-256-GCM authenticated payload encryption with 128-bit integrity tag, 96-bit random nonce, and canonical AAD metadata binding. RSA-OAEP 3072-bit recipient key envelopes.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Access Boundaries
          </div>
          <p className="text-slate-600 leading-relaxed">
            Intruders receive HTTP 403 Forbidden. Download authorizations return ONLY the requesting recipient's key envelope. Private keys never leave browser memory.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Stated Limitations
          </div>
          <p className="text-slate-600 leading-relaxed">
            Local browser storage loss requires key restoration. Compromised host RAM can capture decrypted plaintext. File metadata is visible to server.
          </p>
        </div>
      </div>

      {/* Filters (Clean minimal inline bar, no box) */}
      <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-400 font-mono uppercase text-[10px]">
          <Filter className="w-3 h-3" />
          <span>Filter:</span>
        </div>

        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
          className="bg-transparent border-b border-slate-200 py-1 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
        >
          <option value="">All Results</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="DENIED">DENIED (Unauthorized)</option>
          <option value="FAILED">FAILED</option>
          <option value="TAMPER_DETECTED">TAMPER_DETECTED</option>
        </select>

        <select
          value={filterEventType}
          onChange={(e) => setFilterEventType(e.target.value)}
          className="bg-transparent border-b border-slate-200 py-1 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
        >
          <option value="">All Event Types</option>
          <option value="FILE_SHARE_INITIATED">FILE_SHARE_INITIATED</option>
          <option value="FILE_UPLOAD_COMPLETED">FILE_UPLOAD_COMPLETED</option>
          <option value="DOWNLOAD_AUTHORIZED">DOWNLOAD_AUTHORIZED</option>
          <option value="UNAUTHORIZED_ACCESS_ATTEMPT">UNAUTHORIZED_ACCESS_ATTEMPT</option>
          <option value="CLIENT_DECRYPTION_RESULT">CLIENT_DECRYPTION_RESULT</option>
          <option value="TAMPERING_DEMO_TEST">TAMPERING_DEMO_TEST</option>
          <option value="PUBLIC_KEY_REGISTERED">PUBLIC_KEY_REGISTERED</option>
        </select>

        <span className="text-slate-400 ml-auto font-mono text-[11px]">
          Showing {events.length} of {total} records
        </span>
      </div>

      {/* Audit Log Table (Open, spacious, full width) */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs border-b border-slate-200">
          <thead className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-mono tracking-wider">
            <tr>
              <th className="py-3 pr-4 font-semibold">Timestamp</th>
              <th className="py-3 px-4 font-semibold">Result</th>
              <th className="py-3 px-4 font-semibold">Event Type</th>
              <th className="py-3 px-4 font-semibold">Actor</th>
              <th className="py-3 px-4 font-semibold">Target File</th>
              <th className="py-3 pl-4 font-semibold text-right">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                  Loading audit trail...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                  No matching audit records found.
                </td>
              </tr>
            ) : (
              events.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 pr-4 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                    {new Date(evt.created_at).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`font-mono text-[11px] font-bold ${
                      evt.result === 'SUCCESS' ? 'text-emerald-700' :
                      evt.result === 'DENIED' ? 'text-rose-700' :
                      evt.result === 'TAMPER_DETECTED' ? 'text-purple-700' :
                      'text-slate-600'
                    }`}>
                      {evt.result}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900 break-words-anywhere max-w-xs">
                    {evt.event_type}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 break-words-anywhere font-mono text-[11px] max-w-xs">
                    {evt.actor_email || 'anonymous'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 break-words-anywhere max-w-xs">
                    {evt.original_filename || (evt.file_id ? evt.file_id.substring(0, 16) + '...' : '—')}
                  </td>
                  <td className="py-3.5 pl-4 text-right">
                    <button
                      onClick={() => setSelectedMeta(evt.safe_metadata)}
                      className="text-xs font-semibold text-slate-900 hover:text-slate-600 underline font-mono"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Metadata Inspector Drawer/Modal */}
      {selectedMeta && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">
                Sanitized Event Metadata
              </h3>
              <button
                onClick={() => setSelectedMeta(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="bg-slate-50 p-4 rounded-xl text-xs font-mono text-slate-800 overflow-x-auto max-h-80 border border-slate-200 select-all break-words-anywhere">
              {JSON.stringify(selectedMeta, null, 2)}
            </pre>
            <div className="mt-4 text-[11px] text-slate-400">
              Zero-Exposure Invariant: Passwords, private keys, and plaintext file payloads are strictly scrubbed prior to audit storage.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

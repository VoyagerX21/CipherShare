import React, { useState, useEffect } from 'react';
import { ExecutionEvent } from '../../types';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Cpu,
  Layers
} from 'lucide-react';

interface ExecutionMonitorProps {
  events: ExecutionEvent[];
  activeOperationTitle?: string;
  isEducationalMode?: boolean;
  onReset?: () => void;
}

export const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({
  events,
  activeOperationTitle = 'Cryptographic Operation',
  isEducationalMode = true,
  onReset
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showSampleValues, setShowSampleValues] = useState<boolean>(false);

  // Update step index as events are dynamically appended
  useEffect(() => {
    if (events.length > 0) {
      setCurrentStepIndex(events.length - 1);
    } else {
      setCurrentStepIndex(0);
    }
  }, [events.length]);

  // Auto-play timer for educational step-by-step review
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIndex(prev => {
          if (prev >= events.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, events.length]);

  const activeEvent = events[currentStepIndex];

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-5 py-4 bg-[#0f172a] border-b border-[#1e293b] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm sm:text-base">
              Cryptographic Execution Monitor
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                {isEducationalMode ? 'EDUCATIONAL INSPECTOR' : 'LIVE MONITOR'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">{activeOperationTitle}</p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSampleValues(!showSampleValues)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showSampleValues
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle educational dummy representations"
          >
            {showSampleValues ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Sample Values</span>
          </button>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex <= 0}
              className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={events.length === 0}
              className="p-1.5 text-sky-400 hover:text-sky-300 disabled:opacity-30"
              title={isPlaying ? 'Pause' : 'Auto Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setCurrentStepIndex(Math.min(events.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex >= events.length - 1}
              className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next Step"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {onReset && (
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStepIndex(0);
                  onReset();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center">
          <Layers className="w-10 h-10 text-slate-600 mb-2 stroke-1" />
          <p className="text-sm">No cryptographic execution currently active.</p>
          <p className="text-xs text-slate-500 mt-1">Initiate a share or file download to observe step-by-step cryptographic stages.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1e293b]">
          {/* Timeline / Stage Steps list */}
          <div className="lg:col-span-5 p-4 max-h-[380px] overflow-y-auto space-y-2">
            {events.map((evt, idx) => {
              const isSelected = idx === currentStepIndex;
              return (
                <div
                  key={evt.id || idx}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex(idx);
                  }}
                  className={`p-3 rounded-lg cursor-pointer transition-all border text-left ${
                    isSelected
                      ? 'bg-sky-950/40 border-sky-500/50 shadow-sm shadow-sky-900/30'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-slate-400">Step {idx + 1}/{events.length}</span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {evt.durationMs ? `${evt.durationMs}ms` : 'completed'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {evt.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {evt.status === 'failed' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                    {evt.status === 'running' && (
                      <span className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                    {evt.status === 'pending' && <span className="w-2 h-2 rounded-full bg-slate-600 ml-1 shrink-0" />}
                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-sky-300' : 'text-slate-200'}`}>
                      {evt.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Step Detailed Inspector */}
          <div className="lg:col-span-7 p-5 bg-[#0d131f] flex flex-col justify-between">
            {activeEvent ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-semibold text-sky-400">
                      Active Stage Inspector
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Timestamp: {new Date(activeEvent.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-100 mt-1">{activeEvent.title}</h4>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                    {activeEvent.description}
                  </p>
                </div>

                {/* Cryptographic Parameters / Safe Metadata */}
                {activeEvent.metadata && Object.keys(activeEvent.metadata).length > 0 && (
                  <div className="bg-[#111827] border border-slate-800 rounded-lg p-3">
                    <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verified Stage Parameters & Integrity Info</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(activeEvent.metadata).map(([k, v]) => (
                        <div key={k} className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                          <span className="text-slate-400 block font-mono text-[11px]">{k}:</span>
                          <span className="font-mono text-slate-200 break-all select-all">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Educational Dummy Representation */}
                {showSampleValues && (
                  <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3 text-xs">
                    <span className="text-amber-400 font-semibold block mb-1">
                      Educational Wire Representation (Simulated Sample Value):
                    </span>
                    <p className="text-slate-400 text-[11px] mb-1.5">
                      Note: Raw private keys and plaintext keys are NEVER exposed. The following is a sample format representation for course learning:
                    </p>
                    <code className="font-mono block bg-slate-950 p-2 rounded text-amber-200/90 break-all select-all text-[11px]">
                      {activeEvent.stageKey === 'aes_key_generated' && "RAW_AES_KEY: [256-bit symmetric key in memory: a4f8...b12e]"}
                      {activeEvent.stageKey === 'aes_encrypt_file' && "CIPHERTEXT_SAMPLE: 4a2b9f018e3d5c... + GCM_TAG: 9c71a3028d7b"}
                      {activeEvent.stageKey === 'wrap_aes_key' && "RSA_OAEP_ENVELOPE: 7d8f...39b1 (3072-bit wrapped envelope)"}
                      {activeEvent.stageKey === 'aad_created' && 'AAD_BINDING: {"fileId":"...","senderId":"...","version":"1.0"}'}
                      {activeEvent.stageKey === 'sha256_computed' && "DIGEST: SHA-256 integrity hash verification"}
                      {!['aes_key_generated', 'aes_encrypt_file', 'wrap_aes_key', 'aad_created', 'sha256_computed'].includes(activeEvent.stageKey) &&
                        `PAYLOAD_STAGE: [${activeEvent.stageKey.toUpperCase()}] verified by WebCrypto`}
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 text-xs">Select a stage from the timeline to inspect parameters.</div>
            )}

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 mt-4">
              <span>Security Guarantee: Zero server plaintext exposure</span>
              <span>Web Crypto API (SubtleCrypto)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

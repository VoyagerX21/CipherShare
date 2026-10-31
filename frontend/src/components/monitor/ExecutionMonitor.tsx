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

  useEffect(() => {
    if (events.length > 0) {
      setCurrentStepIndex(events.length - 1);
    } else {
      setCurrentStepIndex(0);
    }
  }, [events.length]);

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
    <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Monitor Header */}
      <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 bg-slate-900 text-white rounded-lg shrink-0">
            <Cpu className="w-4 h-4 text-sky-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-sm">
                Cryptographic Execution Monitor
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                {isEducationalMode ? 'EDUCATIONAL INSPECTOR' : 'LIVE MONITOR'}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate max-w-md break-words-anywhere">{activeOperationTitle}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSampleValues(!showSampleValues)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showSampleValues
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title="Toggle educational dummy values"
          >
            {showSampleValues ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Sample Values</span>
          </button>

          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm">
            <button
              onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex <= 0}
              className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={events.length === 0}
              className="p-1.5 text-slate-700 hover:text-slate-900 disabled:opacity-30"
              title={isPlaying ? 'Pause' : 'Auto Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setCurrentStepIndex(Math.min(events.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex >= events.length - 1}
              className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="p-1.5 text-slate-400 hover:text-slate-700 border-l border-slate-200"
                title="Reset Timeline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="p-10 text-center text-slate-500 flex flex-col items-center justify-center">
          <Layers className="w-8 h-8 text-slate-300 mb-2 stroke-1" />
          <p className="text-sm font-medium text-slate-600">No cryptographic execution currently active.</p>
          <p className="text-xs text-slate-400 mt-1">Initiate a share or download operation to observe real-time cryptographic stages.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Timeline column */}
          <div className="lg:col-span-5 p-4 max-h-[460px] overflow-y-auto space-y-2 bg-slate-50/30">
            {events.map((evt, idx) => {
              const isSelected = idx === currentStepIndex;
              return (
                <div
                  key={evt.id || idx}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex(idx);
                  }}
                  className={`p-3 rounded-xl cursor-pointer transition-all border text-left ${
                    isSelected
                      ? 'bg-white border-slate-900 shadow-sm ring-1 ring-slate-900/10'
                      : 'bg-white/80 border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-slate-400 text-[11px]">Step {idx + 1} of {events.length}</span>
                    <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {evt.durationMs ? `${evt.durationMs}ms` : 'instant'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    {evt.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {evt.status === 'failed' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    {evt.status === 'running' && (
                      <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                    {evt.status === 'pending' && <span className="w-2 h-2 rounded-full bg-slate-400 ml-1 shrink-0" />}
                    <span className={`text-xs font-semibold break-words-anywhere min-w-0 ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                      {evt.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Step Detailed Inspector */}
          <div className="lg:col-span-7 p-6 flex flex-col justify-between space-y-6 bg-white min-w-0">
            {activeEvent ? (
              <div className="space-y-5 min-w-0">
                <div>
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                      Stage Inspector
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(activeEvent.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-2 break-words-anywhere">{activeEvent.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed break-words-anywhere">
                    {activeEvent.description}
                  </p>
                </div>

                {/* Parameters & Safe Metadata */}
                {activeEvent.metadata && Object.keys(activeEvent.metadata).length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-w-0">
                    <div className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Stage Parameters & Verification Proof</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs min-w-0">
                      {Object.entries(activeEvent.metadata).map(([k, v]) => (
                        <div key={k} className="bg-white p-2.5 rounded-lg border border-slate-200 min-w-0 shadow-2xs">
                          <span className="text-slate-400 block font-mono text-[10px]">{k}:</span>
                          <span className="font-mono text-slate-800 text-[11px] break-words-anywhere select-all block mt-0.5">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Educational Sample Representation */}
                {showSampleValues && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs min-w-0">
                    <span className="text-amber-900 font-bold block mb-1">
                      Educational Wire Representation (Simulated Demo Vector):
                    </span>
                    <p className="text-amber-800 text-[11px] mb-2 leading-relaxed">
                      Zero-Knowledge Guarantee: Real private keys and content keys are never visible in logs. Sample vector for learning:
                    </p>
                    <code className="font-mono block bg-white p-2.5 rounded-lg border border-amber-200 text-amber-950 break-words-anywhere select-all text-[11px]">
                      {activeEvent.stageKey === 'aes_key_generated' && "RAW_AES_KEY: [256-bit symmetric key in RAM: a4f8...b12e]"}
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
              <div className="text-slate-400 text-xs py-8 text-center">Select a stage from the timeline.</div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Security Invariant: Zero server plaintext</span>
              <span>W3C SubtleCrypto</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

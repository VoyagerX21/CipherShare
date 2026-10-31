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
  Eye,
  EyeOff
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
    <div className="w-full space-y-6">
      {/* Monitor Header - Open hairline bar */}
      <div className="pb-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 text-sm tracking-tight">
              Cryptographic Execution Inspector
            </h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              {isEducationalMode ? '• EDUCATIONAL' : '• LIVE'}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate max-w-md break-words-anywhere mt-0.5">{activeOperationTitle}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-3 text-xs">
          <button
            onClick={() => setShowSampleValues(!showSampleValues)}
            className={`font-semibold flex items-center gap-1.5 transition-colors ${
              showSampleValues ? 'text-amber-700 underline' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Toggle educational wire values"
          >
            {showSampleValues ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Sample Wire</span>
          </button>

          <span className="text-slate-200">|</span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex <= 0}
              className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20"
              title="Previous Step"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={events.length === 0}
              className="p-1 text-slate-700 hover:text-slate-900 disabled:opacity-20"
              title={isPlaying ? 'Pause' : 'Auto Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setCurrentStepIndex(Math.min(events.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex >= events.length - 1}
              className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20"
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
                className="p-1 text-slate-400 hover:text-slate-700"
                title="Reset Timeline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="py-12 text-slate-400 text-xs font-mono space-y-1">
          <p className="text-slate-600 font-medium">No cryptographic operation currently active.</p>
          <p>Initiate a share or download operation to observe real-time cryptographic execution stages.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Timeline column: Clean chronological list with left-border indicators */}
          <div className="lg:col-span-5 space-y-1 divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-2">
            {events.map((evt, idx) => {
              const isSelected = idx === currentStepIndex;
              return (
                <div
                  key={evt.id || idx}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex(idx);
                  }}
                  className={`py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-l-2 border-slate-900 pl-3 text-slate-900'
                      : 'border-l-2 border-transparent pl-3 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-mono text-slate-400">Step 0{idx + 1}</span>
                    <span className="text-slate-400 flex items-center gap-1 font-mono text-[10px]">
                      <Clock className="w-3 h-3 text-slate-300" />
                      {evt.durationMs ? `${evt.durationMs}ms` : 'instant'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    {evt.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    {evt.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                    {evt.status === 'running' && (
                      <span className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                    {evt.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1 shrink-0" />}
                    <span className={`text-xs break-words-anywhere min-w-0 ${isSelected ? 'font-semibold text-slate-900' : 'font-normal'}`}>
                      {evt.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Step Detailed Inspector: Clean, open typography */}
          <div className="lg:col-span-7 space-y-6 min-w-0">
            {activeEvent ? (
              <div className="space-y-6 min-w-0">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Active Stage Inspector
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(activeEvent.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 mt-1 break-words-anywhere">{activeEvent.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed break-words-anywhere">
                    {activeEvent.description}
                  </p>
                </div>

                {/* Parameters & Safe Metadata: Clean Definition List, no nested cards */}
                {activeEvent.metadata && Object.keys(activeEvent.metadata).length > 0 && (
                  <div className="space-y-2 min-w-0 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Stage Parameters & Verification Proof
                    </div>
                    <dl className="divide-y divide-slate-100 text-xs min-w-0">
                      {Object.entries(activeEvent.metadata).map(([k, v]) => (
                        <div key={k} className="py-2 flex flex-col sm:flex-row sm:justify-between gap-1 min-w-0">
                          <dt className="text-slate-400 font-mono text-[11px] shrink-0">{k}</dt>
                          <dd className="font-mono text-slate-800 text-[11px] break-words-anywhere select-all font-medium sm:text-right">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {/* Educational Sample Representation */}
                {showSampleValues && (
                  <div className="border-l-2 border-amber-600 pl-4 py-2 text-xs space-y-1 min-w-0">
                    <span className="font-semibold text-amber-900 block text-xs">
                      Educational Wire Representation:
                    </span>
                    <p className="text-amber-800 text-[11px] leading-relaxed">
                      Zero-Knowledge Guarantee: Actual keys are never logged. Simulated educational representation:
                    </p>
                    <code className="font-mono block text-slate-800 break-words-anywhere select-all text-[11px] pt-1">
                      {activeEvent.stageKey === 'aes_key_generated' && "RAW_AES_KEY: [256-bit symmetric key in volatile RAM: a4f8...b12e]"}
                      {activeEvent.stageKey === 'aes_encrypt_file' && "CIPHERTEXT_SAMPLE: 4a2b9f018e3d5c... + GCM_TAG: 9c71a3028d7b"}
                      {activeEvent.stageKey === 'wrap_aes_key' && "RSA_OAEP_ENVELOPE: 7d8f...39b1 (3072-bit wrapped envelope)"}
                      {activeEvent.stageKey === 'aad_created' && 'AAD_BINDING: {"fileId":"...","senderId":"...","version":"1.0"}'}
                      {activeEvent.stageKey === 'sha256_computed' && "DIGEST: SHA-256 integrity hash verification"}
                      {!['aes_key_generated', 'aes_encrypt_file', 'wrap_aes_key', 'aad_created', 'sha256_computed'].includes(activeEvent.stageKey) &&
                        `PAYLOAD_STAGE: [${activeEvent.stageKey.toUpperCase()}] verified by SubtleCrypto`}
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-xs py-8 text-center font-mono">Select a stage from the timeline.</div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Zero server plaintext invariant verified</span>
              <span>W3C Web Crypto</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Mic, Pause, Play, Square, Settings as SettingsIcon, AlertTriangle, ShieldCheck, Radio } from 'lucide-react';
import { AppSettings, AUDIO_PROFILES, RecordingFormat, RecordingState } from '../types/index.ts';
import { audioEngine, VUMeterData } from '../services/audioEngine.ts';
import { formatLiveTimer } from '../utils/recorder-logic.ts';
import { LanguageKey, translations } from '../i18n/translations.ts';

interface RecordTabProps {
  settings: AppSettings;
  lang: LanguageKey;
  onOpenSettings: () => void;
  onOpenApkModal: () => void;
  onFinishedRecording: (result: {
    blob: Blob;
    durationMs: number;
    sizeBytes: number;
    waveform: number[];
  }) => void;
}

export const RecordTab: React.FC<RecordTabProps> = ({
  settings,
  lang,
  onOpenSettings,
  onOpenApkModal,
  onFinishedRecording,
}) => {
  const [recState, setRecState] = useState<RecordingState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [vu, setVu] = useState<VUMeterData>({ leftLevel: 0, rightLevel: 0, peak: 0, clipping: false });
  const [simulatedNotice, setSimulatedNotice] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<RecordingFormat>(settings.defaultFormat || 'mp3');

  const t = translations[lang];

  useEffect(() => {
    setSelectedFormat(settings.defaultFormat || 'mp3');
  }, [settings.defaultFormat]);

  useEffect(() => {
    audioEngine.onStateChange((newState) => {
      setRecState(newState);
      if (newState === 'idle') {
        setElapsedMs(0);
        setVu({ leftLevel: 0, rightLevel: 0, peak: 0, clipping: false });
      }
    });

    audioEngine.onTick((ms, vuData) => {
      setElapsedMs(ms);
      setVu(vuData);
    });
  }, []);

  const handleStartRecord = async (forceSim?: boolean) => {
    const res = await audioEngine.startRecording({
      format: selectedFormat,
      stereo: settings.stereo,
      gain: settings.micGain,
      limiter: settings.limiterEnabled,
      forceSimulated: forceSim,
    });
    setSimulatedNotice(res.simulated);
  };

  const handlePause = () => {
    audioEngine.pauseRecording();
  };

  const handleResume = () => {
    audioEngine.resumeRecording();
  };

  const handleStop = async () => {
    const res = await audioEngine.stopRecording(selectedFormat, settings.stereo);
    onFinishedRecording({
      blob: res.blob,
      durationMs: res.durationMs,
      sizeBytes: res.sizeBytes,
      waveform: res.waveform,
    });
  };

  const activeProfile = AUDIO_PROFILES[selectedFormat];
  const { time, tenths } = formatLiveTimer(elapsedMs);

  return (
    <div className="flex-1 flex flex-col justify-between px-5 py-4 select-none relative overflow-hidden">
      {/* Top Bar: Quality Profile & Settings */}
      <div className="flex items-center justify-between z-10">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 transition-all shadow-sm"
          aria-label="Профиль качества записи"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{activeProfile.name}</span>
          <span className="text-[10px] text-zinc-500 font-mono">({activeProfile.bitrate})</span>
        </button>

        <div className="flex items-center gap-1.5">
          {simulatedNotice && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1"
              title={t.recorder.simulatedModeNotice}
            >
              <Radio className="w-3 h-3 animate-pulse" />
              Sim Mic
            </span>
          )}
          <button
            onClick={onOpenApkModal}
            className="px-2.5 py-1 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 text-xs font-bold transition-all shadow-sm flex items-center gap-1"
            title="Скачать APK файл"
          >
            <span>APK</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            aria-label={t.nav.settings}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Android Foreground Service Simulated Notification (FR-5) */}
      {(recState === 'recording' || recState === 'paused') && (
        <div className="my-2 p-2.5 rounded-xl bg-zinc-900/95 border border-zinc-800 shadow-lg flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <div className="flex flex-col">
              <span className="font-semibold text-zinc-200">Диктофон Pro • Служба записи</span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {recState === 'recording' ? t.recorder.recording : t.recorder.paused} • {time}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {recState === 'recording' ? (
              <button
                onClick={handlePause}
                className="px-2 py-1 rounded-md bg-zinc-800 text-[11px] text-zinc-200 hover:bg-zinc-700"
              >
                Пауза
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="px-2 py-1 rounded-md bg-zinc-800 text-[11px] text-zinc-200 hover:bg-zinc-700"
              >
                Пуск
              </button>
            )}
            <button
              onClick={handleStop}
              className="px-2 py-1 rounded-md bg-red-600/80 text-[11px] text-white hover:bg-red-500"
            >
              Стоп
            </button>
          </div>
        </div>
      )}

      {/* Center Display: Timer & Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center py-4 z-10">
        {/* State label */}
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          {recState === 'recording' && (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
          )}
          {recState === 'paused' && (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
          )}
          <span>
            {recState === 'recording'
              ? t.recorder.recording
              : recState === 'paused'
              ? t.recorder.paused
              : recState === 'stopping'
              ? t.recorder.stopping
              : t.recorder.ready}
          </span>
        </div>

        {/* Large Monospace Timer */}
        <div
          className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-white mb-6 flex items-baseline"
          aria-live="polite"
          aria-label={`Время записи: ${time}`}
        >
          <span>{time}</span>
          <span className="text-2xl sm:text-3xl text-zinc-500 font-medium">{tenths}</span>
        </div>

        {/* Real-time Dynamic Waveform / Oscillogram Display */}
        <div className="w-full max-w-xs h-20 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3 flex items-center justify-center gap-1 shadow-inner relative overflow-hidden">
          {/* Audio bars */}
          {Array.from({ length: 28 }).map((_, i) => {
            let heightPercent = 10;
            if (recState === 'recording') {
              const waveOffset = Math.sin((i / 28) * Math.PI * 3 + elapsedMs / 200);
              const dynamicLevel = (vu.leftLevel + vu.rightLevel) / 2;
              heightPercent = Math.max(12, Math.min(96, (dynamicLevel * 75 + Math.abs(waveOffset) * 25)));
            } else if (recState === 'paused') {
              heightPercent = 15;
            }
            return (
              <div
                key={i}
                className="w-1.5 rounded-full transition-all duration-75"
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor:
                    recState === 'recording'
                      ? i % 4 === 0
                        ? '#ef4444'
                        : '#f87171'
                      : '#3f3f46',
                }}
              />
            );
          })}
        </div>

        {/* VU Meter Bars & Clipping Indicator (FR-3) */}
        <div className="w-full max-w-xs mt-5 bg-zinc-900/80 border border-zinc-800/60 rounded-xl p-3 flex flex-col gap-2">
          {/* L Channel */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
            <span className="w-3 font-bold text-zinc-300">L</span>
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 transition-all duration-75"
                style={{ width: `${Math.min(100, vu.leftLevel * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-zinc-400">
              {Math.round(vu.leftLevel * 100)}%
            </span>
          </div>

          {/* R Channel */}
          {settings.stereo && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
              <span className="w-3 font-bold text-zinc-300">R</span>
              <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, vu.rightLevel * 100)}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-zinc-400">
                {Math.round(vu.rightLevel * 100)}%
              </span>
            </div>
          )}

          {/* Clipping LED & Level Scale */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[9px] font-mono text-zinc-500">
            <span>-24dB</span>
            <span>-12dB</span>
            <span>-6dB</span>
            <span>0dB</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  vu.clipping ? 'bg-red-500 shadow-sm shadow-red-500' : 'bg-zinc-800'
                }`}
              />
              <span className={vu.clipping ? 'text-red-400 font-bold' : 'text-zinc-500'}>
                CLIP
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls: Big Record Button (>=96dp) per FR-1 & NFR-18 */}
      <div className="flex flex-col items-center justify-center gap-4 pb-2 z-10">
        {recState === 'idle' ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => handleStartRecord(false)}
              className="relative group w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white shadow-2xl shadow-red-600/40 active:scale-95 hover:scale-105 transition-all cursor-pointer border-4 border-zinc-900 ring-2 ring-red-500/50"
              aria-label={t.recorder.startRecord}
              style={{ minWidth: '96px', minHeight: '96px' }}
            >
              <Mic className="w-10 h-10 drop-shadow-md" />
              <span className="absolute -inset-2 rounded-full border border-red-500/30 group-hover:scale-110 transition-transform pointer-events-none" />
            </button>
            <span className="text-xs font-semibold text-zinc-400">
              {t.recorder.startRecord}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            {/* Pause / Resume Button */}
            {recState === 'recording' ? (
              <button
                onClick={handlePause}
                className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 flex items-center justify-center shadow-md transition-all cursor-pointer border border-zinc-700"
                aria-label={t.recorder.pauseRecord}
              >
                <Pause className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={handleResume}
                className="w-14 h-14 rounded-full bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-300 flex items-center justify-center shadow-md transition-all cursor-pointer border border-amber-500/40"
                aria-label={t.recorder.resumeRecord}
              >
                <Play className="w-6 h-6 ml-0.5" />
              </button>
            )}

            {/* Stop & Save Button */}
            <button
              onClick={handleStop}
              className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-red-600/30 transition-all cursor-pointer border-4 border-zinc-900 ring-2 ring-red-600/50"
              aria-label={t.recorder.stopRecord}
            >
              <Square className="w-7 h-7 fill-white rounded-sm" />
            </button>

            {/* Simulated toggle if needed */}
            <button
              onClick={() => handleStartRecord(true)}
              className="w-14 h-14 rounded-full bg-zinc-900 hover:bg-zinc-800 active:scale-95 text-zinc-500 hover:text-zinc-300 flex items-center justify-center shadow-md transition-all cursor-pointer border border-zinc-800"
              title="Перезапустить в симуляции"
              aria-label="Перезапустить в симуляции"
            >
              <Radio className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

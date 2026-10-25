import React, { useState, useEffect, useRef } from 'react';
import { Scissors, Play, Pause, Save, RotateCcw, Check, Sparkles, Layers } from 'lucide-react';
import { Recording } from '../types/index.ts';
import { encodeMp3, extractWaveform } from '../services/audioEncoder.ts';
import {
  trimAudioChannel,
  cutAudioChannelSegment,
  formatDuration,
} from '../utils/recorder-logic.ts';
import { LanguageKey, translations } from '../i18n/translations.ts';

interface EditorTabProps {
  recordings: Recording[];
  activeRecording: Recording | null;
  lang: LanguageKey;
  onSaveNewCopy: (newRecording: Recording, blob: Blob) => void;
  onSelectRecording: (rec: Recording) => void;
}

export const EditorTab: React.FC<EditorTabProps> = ({
  recordings,
  activeRecording,
  lang,
  onSaveNewCopy,
  onSelectRecording,
}) => {
  const [selectedRecId, setSelectedRecId] = useState<string>(activeRecording?.id || '');
  const [mode, setMode] = useState<'trim' | 'cut' | 'split'>('trim');
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(5);
  const [splitSec, setSplitSec] = useState(2.5);
  const [newTitle, setNewTitle] = useState('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const t = translations[lang];

  const currentRec = recordings.find((r) => r.id === selectedRecId) || activeRecording || recordings[0];

  useEffect(() => {
    if (currentRec) {
      const durSec = (currentRec.durationMs || 5000) / 1000;
      setStartSec(0);
      setEndSec(Math.max(1, Math.min(durSec, durSec * 0.8)));
      setSplitSec(durSec / 2);
      setNewTitle(`${currentRec.title} (${mode === 'trim' ? 'Trim' : mode === 'cut' ? 'Cut' : 'Split'})`);
    }
  }, [currentRec?.id, mode]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  if (!currentRec) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-400">
        <Scissors className="w-12 h-12 text-zinc-600 mb-2" />
        <h2 className="text-sm font-semibold text-zinc-200">{t.editor.selectRecording}</h2>
      </div>
    );
  }

  const durationSec = Math.max(1, (currentRec.durationMs || 5000) / 1000);

  const handlePreview = async () => {
    if (isPlayingPreview && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
      return;
    }

    if (!currentRec.audioBlob) return;

    try {
      const arrayBuffer = await currentRec.audioBlob.arrayBuffer();
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const decoded = await ctx.decodeAudioData(arrayBuffer);

      let editedLeft: Float32Array;
      let editedRight: Float32Array | null = null;

      if (mode === 'trim') {
        editedLeft = trimAudioChannel(decoded.getChannelData(0), decoded.sampleRate, startSec, endSec);
        if (decoded.numberOfChannels > 1) {
          editedRight = trimAudioChannel(decoded.getChannelData(1), decoded.sampleRate, startSec, endSec);
        }
      } else if (mode === 'cut') {
        editedLeft = cutAudioChannelSegment(decoded.getChannelData(0), decoded.sampleRate, startSec, endSec);
        if (decoded.numberOfChannels > 1) {
          editedRight = cutAudioChannelSegment(decoded.getChannelData(1), decoded.sampleRate, startSec, endSec);
        }
      } else {
        // split part 1
        editedLeft = trimAudioChannel(decoded.getChannelData(0), decoded.sampleRate, 0, splitSec);
        if (decoded.numberOfChannels > 1) {
          editedRight = trimAudioChannel(decoded.getChannelData(1), decoded.sampleRate, 0, splitSec);
        }
      }

      const previewBlob = encodeMp3(editedLeft, editedRight, decoded.sampleRate, 128);
      const url = URL.createObjectURL(previewBlob);

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }

      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => setIsPlayingPreview(false);
      audio.onpause = () => setIsPlayingPreview(false);
      audio.onplay = () => setIsPlayingPreview(true);
      await audio.play();
    } catch (err) {
      console.error('Preview error:', err);
    }
  };

  const handleSaveCopy = async () => {
    if (!currentRec.audioBlob) return;
    setIsProcessing(true);

    try {
      const arrayBuffer = await currentRec.audioBlob.arrayBuffer();
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const decoded = await ctx.decodeAudioData(arrayBuffer);

      let editedLeft: Float32Array;
      let editedRight: Float32Array | null = null;

      if (mode === 'trim') {
        editedLeft = trimAudioChannel(decoded.getChannelData(0), decoded.sampleRate, startSec, endSec);
        if (decoded.numberOfChannels > 1) {
          editedRight = trimAudioChannel(decoded.getChannelData(1), decoded.sampleRate, startSec, endSec);
        }
      } else if (mode === 'cut') {
        editedLeft = cutAudioChannelSegment(decoded.getChannelData(0), decoded.sampleRate, startSec, endSec);
        if (decoded.numberOfChannels > 1) {
          editedRight = cutAudioChannelSegment(decoded.getChannelData(1), decoded.sampleRate, startSec, endSec);
        }
      } else {
        // split part 1
        editedLeft = trimAudioChannel(decoded.getChannelData(0), decoded.sampleRate, 0, splitSec);
        if (decoded.numberOfChannels > 1) {
          editedRight = trimAudioChannel(decoded.getChannelData(1), decoded.sampleRate, 0, splitSec);
        }
      }

      const blob = encodeMp3(editedLeft, editedRight, decoded.sampleRate, 128);
      const waveform = extractWaveform(editedLeft, 80);
      const durationMs = Math.round((editedLeft.length / decoded.sampleRate) * 1000);

      const newRec: Recording = {
        id: `rec-${Date.now()}`,
        title: newTitle.trim() || `${currentRec.title} (Edit)`,
        filePath: `/storage/emulated/0/Music/Dictaphone/${newTitle.trim()}.mp3`,
        format: 'mp3',
        sampleRate: decoded.sampleRate,
        channels: editedRight ? 2 : 1,
        durationMs,
        sizeBytes: blob.size,
        createdAt: Date.now(),
        note: `Отредактировано из «${currentRec.title}» (${mode})`,
        isFavorite: false,
        deletedAt: null,
        waveform,
        tags: [...(currentRec.tags || []), 'Редактор'],
        audioBlob: blob,
      };

      onSaveNewCopy(newRec, blob);
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-4 py-3 select-none overflow-y-auto">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Scissors className="w-5 h-5 text-red-500" />
          {t.editor.title}
        </h1>
        <p className="text-xs text-zinc-400">{t.editor.subtitle}</p>
      </div>

      {/* Select Source Recording */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-zinc-300 mb-1">
          {t.editor.selectRecording}
        </label>
        <select
          value={currentRec.id}
          onChange={(e) => {
            const found = recordings.find((r) => r.id === e.target.value);
            if (found) onSelectRecording(found);
          }}
          className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 font-medium focus:outline-none focus:border-red-500 cursor-pointer"
        >
          {recordings
            .filter((r) => r.deletedAt === null)
            .map((rec) => (
              <option key={rec.id} value={rec.id}>
                {rec.title} ({formatDuration(rec.durationMs)})
              </option>
            ))}
        </select>
      </div>

      {/* Mode Tabs: Trim / Cut / Split */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 mb-4">
        <button
          onClick={() => setMode('trim')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === 'trim'
              ? 'bg-red-600 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t.editor.trimTab}
        </button>
        <button
          onClick={() => setMode('cut')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === 'cut'
              ? 'bg-red-600 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t.editor.cutTab}
        </button>
        <button
          onClick={() => setMode('split')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === 'split'
              ? 'bg-red-600 text-white shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {t.editor.splitTab}
        </button>
      </div>

      {/* Visual Waveform Range Canvas / Preview */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-4 relative shadow-inner">
        <div className="text-xs text-zinc-400 mb-2 flex justify-between items-center font-mono">
          <span>0.00с</span>
          <span className="text-zinc-200 font-bold">
            {mode === 'split'
              ? `Метка раздела: ${splitSec.toFixed(2)}с`
              : `Диапазон: ${(endSec - startSec).toFixed(2)}с`}
          </span>
          <span>{durationSec.toFixed(2)}с</span>
        </div>

        {/* Waveform Bar visualization with highlight zone */}
        <div className="h-20 w-full flex items-center justify-between gap-0.5 relative py-2">
          {(currentRec.waveform || []).slice(0, 50).map((peak, idx) => {
            const timePos = (idx / 50) * durationSec;
            let isInZone = false;
            if (mode === 'split') {
              isInZone = timePos <= splitSec;
            } else {
              isInZone = timePos >= startSec && timePos <= endSec;
            }

            return (
              <div
                key={idx}
                className={`w-1 rounded-full transition-colors ${
                  mode === 'cut'
                    ? isInZone
                      ? 'bg-red-500/30' // cut out zone
                      : 'bg-emerald-500' // kept zone
                    : isInZone
                    ? 'bg-red-500' // kept zone
                    : 'bg-zinc-800' // discarded
                }`}
                style={{ height: `${Math.max(15, peak * 95)}%` }}
              />
            );
          })}
        </div>

        <p className="text-[11px] text-zinc-500 mt-2 text-center">{t.editor.trimNotice}</p>
      </div>

      {/* Range Sliders Controls */}
      {mode === 'split' ? (
        <div className="space-y-3 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 mb-4">
          <div className="flex justify-between items-center text-xs font-semibold text-zinc-300">
            <span>Метка разделения</span>
            <span className="font-mono text-red-400">{splitSec.toFixed(2)} сек</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={durationSec}
            step={0.1}
            value={splitSec}
            onChange={(e) => setSplitSec(parseFloat(e.target.value))}
            className="w-full accent-red-500"
          />
        </div>
      ) : (
        <div className="space-y-3 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 mb-4">
          {/* Start Slider */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-zinc-300 mb-1">
              <span>{mode === 'trim' ? t.editor.startLabel : t.editor.cutStartLabel}</span>
              <span className="font-mono text-red-400">{startSec.toFixed(2)} сек</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, endSec - 0.2)}
              step={0.1}
              value={startSec}
              onChange={(e) => setStartSec(parseFloat(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>

          {/* End Slider */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-zinc-300 mb-1">
              <span>{mode === 'trim' ? t.editor.endLabel : t.editor.cutEndLabel}</span>
              <span className="font-mono text-red-400">{endSec.toFixed(2)} сек</span>
            </div>
            <input
              type="range"
              min={Math.min(durationSec, startSec + 0.2)}
              max={durationSec}
              step={0.1}
              value={endSec}
              onChange={(e) => setEndSec(parseFloat(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>
        </div>
      )}

      {/* Name for New Copy */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
          Название новой записи (копии):
        </label>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Название файла..."
          className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-red-500"
        />
      </div>

      {/* Action Buttons: Preview & Save Copy */}
      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={handlePreview}
          className="w-full h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-zinc-700"
        >
          {isPlayingPreview ? <Pause className="w-4 h-4 text-red-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
          <span>{isPlayingPreview ? 'Остановить превью' : t.editor.preview}</span>
        </button>

        <button
          onClick={handleSaveCopy}
          disabled={isProcessing}
          className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isProcessing ? t.editor.processing : t.editor.saveCopy}</span>
        </button>

        {successNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-center gap-1.5 animate-fade-in">
            <Check className="w-4 h-4" />
            <span>{t.editor.successSave}</span>
          </div>
        )}
      </div>
    </div>
  );
};

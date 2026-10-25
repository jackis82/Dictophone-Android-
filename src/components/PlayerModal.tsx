import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Share2,
  Download,
  Scissors,
  FileText,
  Tag,
  Star,
  Check,
  Plus,
} from 'lucide-react';
import { Recording } from '../types/index.ts';
import { audioEngine } from '../services/audioEngine.ts';
import { formatDuration } from '../utils/recorder-logic.ts';
import { LanguageKey, translations } from '../i18n/translations.ts';

interface PlayerModalProps {
  recording: Recording;
  isOpen: boolean;
  isPlaying: boolean;
  currentPosMs: number;
  durationMs: number;
  lang: LanguageKey;
  onClose: () => void;
  onTogglePlay: () => void;
  onSeek: (posMs: number) => void;
  onOpenEditor: (rec: Recording) => void;
  onSaveMetadata: (id: string, updates: { note?: string; tags?: string[]; isFavorite?: boolean }) => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  recording,
  isOpen,
  isPlaying,
  currentPosMs,
  durationMs,
  lang,
  onClose,
  onTogglePlay,
  onSeek,
  onOpenEditor,
  onSaveMetadata,
}) => {
  const [speed, setSpeed] = useState(1.0);
  const [noteText, setNoteText] = useState(recording.note || '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  useEffect(() => {
    setNoteText(recording.note || '');
  }, [recording]);

  if (!isOpen) return null;

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    audioEngine.setPlaybackRate(newSpeed);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetMs = Math.floor(ratio * (durationMs || recording.durationMs));
    onSeek(targetMs);
  };

  const handleJump = (seconds: number) => {
    const total = durationMs || recording.durationMs;
    const targetMs = Math.max(0, Math.min(total, currentPosMs + seconds * 1000));
    onSeek(targetMs);
  };

  const handleSaveNote = () => {
    onSaveMetadata(recording.id, { note: noteText });
    setIsEditingNote(false);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTagInput.trim();
    if (!clean) return;
    const currentTags = recording.tags || [];
    if (!currentTags.includes(clean)) {
      const updated = [...currentTags, clean];
      onSaveMetadata(recording.id, { tags: updated });
    }
    setNewTagInput('');
    setShowTagInput(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = (recording.tags || []).filter((tg) => tg !== tagToRemove);
    onSaveMetadata(recording.id, { tags: updated });
  };

  const totalDuration = durationMs || recording.durationMs || 1000;
  const progressRatio = Math.max(0, Math.min(1, currentPosMs / totalDuration));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-zinc-950 border border-zinc-800 p-5 shadow-2xl text-zinc-100 flex flex-col gap-4">
        {/* Top Handle / Close */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {t.player.nowPlaying}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onSaveMetadata(recording.id, { isFavorite: !recording.isFavorite })}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-400"
              aria-label="Избранное"
            >
              <Star
                className={`w-4 h-4 ${recording.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title & Format Info */}
        <div className="text-center pt-2">
          <h2 className="text-lg font-bold text-white tracking-tight line-clamp-1">
            {recording.title}
          </h2>
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 mt-1 font-mono">
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold uppercase text-zinc-300">
              {recording.format}
            </span>
            <span>•</span>
            <span>{new Date(recording.createdAt).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>

        {/* Interactive Waveform Display with Scrubber (FR-20) */}
        <div className="my-2">
          <div
            ref={waveformRef}
            onClick={handleWaveformClick}
            className="w-full h-24 bg-zinc-900/90 rounded-2xl p-3 border border-zinc-800 flex items-center justify-between gap-0.5 relative cursor-pointer group shadow-inner overflow-hidden"
          >
            {/* Waveform Bars */}
            {(recording.waveform || []).slice(0, 60).map((peak, idx) => {
              const barRatio = idx / 60;
              const isPlayed = barRatio <= progressRatio;
              return (
                <div
                  key={idx}
                  className={`w-1 rounded-full transition-colors ${
                    isPlayed ? 'bg-red-500' : 'bg-zinc-700/60'
                  }`}
                  style={{ height: `${Math.max(12, peak * 95)}%` }}
                />
              );
            })}

            {/* Scrubber Playhead Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
              style={{ left: `${progressRatio * 100}%` }}
            >
              <div className="w-3 h-3 rounded-full bg-white shadow -ml-[5px] -mt-1" />
            </div>
          </div>

          {/* Time Labels */}
          <div className="flex justify-between items-center text-xs font-mono text-zinc-400 mt-1.5 px-1">
            <span>{formatDuration(currentPosMs)}</span>
            <span>{formatDuration(totalDuration)}</span>
          </div>
        </div>

        {/* Player Controls (FR-19) */}
        <div className="flex flex-col items-center gap-4 py-1">
          <div className="flex items-center justify-center gap-5">
            {/* Jump -10s */}
            <button
              onClick={() => handleJump(-10)}
              className="p-2.5 rounded-full bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-all cursor-pointer"
              title={t.player.back10}
              aria-label={t.player.back10}
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={onTogglePlay}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-red-600/30 transition-all cursor-pointer border-2 border-red-500"
              aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
            </button>

            {/* Jump +10s */}
            <button
              onClick={() => handleJump(10)}
              className="p-2.5 rounded-full bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-800 transition-all cursor-pointer"
              title={t.player.forward10}
              aria-label={t.player.forward10}
            >
              <RotateCw className="w-5 h-5" />
            </button>
          </div>

          {/* Speed Selector (0.5x - 2.0x) */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs">
            <span className="text-[11px] text-zinc-500 px-2 font-medium">{t.player.speed}:</span>
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-0.5 rounded-lg font-mono transition-colors ${
                  speed === s
                    ? 'bg-red-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Quick Action: Open in Editor */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              onClose();
              onOpenEditor(recording);
            }}
            className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Scissors className="w-4 h-4 text-red-400" />
            <span>{t.library.openInEditor}</span>
          </button>
        </div>

        {/* Notes Section (FR-17) */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              {t.player.editNote}
            </span>
            {!isEditingNote ? (
              <button
                onClick={() => setIsEditingNote(true)}
                className="text-[11px] text-red-400 hover:text-red-300 font-medium"
              >
                {recording.note ? 'Редактировать' : '+ Добавить'}
              </button>
            ) : (
              <button
                onClick={handleSaveNote}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {t.player.saveNote}
              </button>
            )}
          </div>

          {isEditingNote ? (
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t.player.addNote}
              rows={2}
              className="w-full p-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500"
            />
          ) : (
            <p className="text-xs text-zinc-400 italic">
              {recording.note ? `"${recording.note}"` : 'Заметки нет'}
            </p>
          )}
        </div>

        {/* Tags Section (FR-17) */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              {t.player.tags}
            </span>
            <button
              onClick={() => setShowTagInput(!showTagInput)}
              className="text-[11px] text-red-400 hover:text-red-300 font-medium flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              {t.player.addTag}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(recording.tags || []).map((tg) => (
              <span
                key={tg}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700/80"
              >
                #{tg}
                <button
                  onClick={() => handleRemoveTag(tg)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {showTagInput && (
            <form onSubmit={handleAddTag} className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Новый тег..."
                autoFocus
                className="flex-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold"
              >
                ОК
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

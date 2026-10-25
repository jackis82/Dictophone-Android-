import React from 'react';
import { Play, Pause, ChevronUp } from 'lucide-react';
import { Recording } from '../types/index.ts';
import { formatDuration } from '../utils/recorder-logic.ts';

interface MiniPlayerProps {
  recording: Recording | null;
  isPlaying: boolean;
  currentPosMs: number;
  durationMs: number;
  onTogglePlay: () => void;
  onExpand: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  recording,
  isPlaying,
  currentPosMs,
  durationMs,
  onTogglePlay,
  onExpand,
}) => {
  if (!recording) return null;

  const total = durationMs || recording.durationMs || 1000;
  const progressPercent = Math.min(100, Math.max(0, (currentPosMs / total) * 100));

  return (
    <div
      onClick={onExpand}
      className="w-full bg-zinc-900/95 border-t border-zinc-800 px-4 py-2 flex flex-col gap-1 cursor-pointer hover:bg-zinc-850 transition-colors shadow-2xl relative select-none"
    >
      {/* Top micro progress line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800">
        <div
          className="h-full bg-red-500 transition-all duration-100"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white truncate">{recording.title}</h4>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
              <span>{formatDuration(currentPosMs)} / {formatDuration(total)}</span>
              <span className="uppercase text-zinc-500 font-bold">{recording.format}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow transition-transform active:scale-95"
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={onExpand}
            className="p-1 text-zinc-400 hover:text-white"
            aria-label="Развернуть плеер"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

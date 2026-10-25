import React from 'react';
import { X, Trash2, RotateCcw, AlertTriangle, FileAudio } from 'lucide-react';
import { Recording } from '../types/index.ts';
import { calculateTrashExpiry, formatDuration, formatFileSize } from '../utils/recorder-logic.ts';
import { LanguageKey, translations } from '../i18n/translations.ts';

interface TrashModalProps {
  isOpen: boolean;
  trashRecordings: Recording[];
  lang: LanguageKey;
  onClose: () => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEmptyAll: () => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({
  isOpen,
  trashRecordings,
  lang,
  onClose,
  onRestore,
  onPermanentDelete,
  onEmptyAll,
}) => {
  const t = translations[lang];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 p-5 shadow-2xl text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              {t.trash.title}
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">{t.trash.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          {trashRecordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 text-center">
              <Trash2 className="w-10 h-10 stroke-[1.5] mb-2 text-zinc-600" />
              <span className="text-sm font-semibold text-zinc-400">{t.trash.empty}</span>
            </div>
          ) : (
            trashRecordings.map((rec) => {
              const { daysLeft } = calculateTrashExpiry(rec.deletedAt, 30);
              return (
                <div
                  key={rec.id}
                  className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-zinc-200 truncate">{rec.title}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
                      <span>{formatDuration(rec.durationMs)}</span>
                      <span>•</span>
                      <span>{formatFileSize(rec.sizeBytes)}</span>
                      <span>•</span>
                      <span className="text-amber-400 font-bold">{daysLeft} {t.trash.daysLeft}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onRestore(rec.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 transition-colors"
                      title={t.trash.restore}
                      aria-label="Восстановить"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onPermanentDelete(rec.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-950 text-red-400 transition-colors"
                      title={t.trash.deletePermanent}
                      aria-label="Удалить навсегда"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {trashRecordings.length > 0 && (
          <div className="pt-3 border-t border-zinc-800 flex justify-end">
            <button
              onClick={onEmptyAll}
              className="px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.trash.emptyAll}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

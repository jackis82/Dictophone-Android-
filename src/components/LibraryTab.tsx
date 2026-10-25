import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Star,
  Play,
  Pause,
  Trash2,
  Share2,
  Download,
  Scissors,
  MoreVertical,
  Calendar,
  Clock,
  HardDrive,
  FileAudio,
  Tag as TagIcon,
  X,
  Edit2,
} from 'lucide-react';
import { Recording, SortField } from '../types/index.ts';
import {
  filterAndSortRecordings,
  formatDuration,
  formatFileSize,
  groupRecordingsByDate,
} from '../utils/recorder-logic.ts';
import { LanguageKey, translations } from '../i18n/translations.ts';

interface LibraryTabProps {
  recordings: Recording[];
  activePlayingId: string | null;
  isPlaying: boolean;
  lang: LanguageKey;
  onPlayRecording: (recording: Recording) => void;
  onPauseRecording: () => void;
  onToggleFavorite: (id: string) => void;
  onMoveToTrash: (id: string) => void;
  onRenameRequest: (recording: Recording) => void;
  onOpenEditor: (recording: Recording) => void;
  onOpenTrash: () => void;
  trashCount: number;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  recordings,
  activePlayingId,
  isPlaying,
  lang,
  onPlayRecording,
  onPauseRecording,
  onToggleFavorite,
  onMoveToTrash,
  onRenameRequest,
  onOpenEditor,
  onOpenTrash,
  trashCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date_desc');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const t = translations[lang];

  // Extract all distinct tags from active recordings
  const allTags = Array.from(
    new Set(
      recordings
        .filter((r) => r.deletedAt === null)
        .flatMap((r) => r.tags || [])
    )
  );

  const filtered = filterAndSortRecordings(recordings, {
    query: searchQuery,
    sort: sortField,
    activeTag,
    onlyFavorites,
    includeTrash: false,
  });

  const grouped = groupRecordingsByDate(filtered, {
    today: t.library.today,
    yesterday: t.library.yesterday,
  });

  const handleShare = async (rec: Recording, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share && rec.audioBlob) {
      try {
        const file = new File([rec.audioBlob], `${rec.title}.${rec.format}`, {
          type: rec.audioBlob.type || 'audio/mp3',
        });
        await navigator.share({
          title: rec.title,
          files: [file],
        });
      } catch (err) {
        console.warn('Share was cancelled or unsupported:', err);
      }
    } else {
      // Fallback: trigger download
      handleDownload(rec, e);
    }
  };

  const handleDownload = (rec: Recording, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rec.audioBlob) return;
    const url = URL.createObjectURL(rec.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rec.title}.${rec.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col px-4 py-3 select-none overflow-hidden relative">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{t.library.title}</h1>
          <p className="text-xs text-zinc-400">
            {filtered.length} {t.library.recordingsCount}
          </p>
        </div>

        {/* Trash button */}
        <button
          onClick={onOpenTrash}
          className="relative px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          aria-label={t.library.trashBin}
        >
          <Trash2 className="w-4 h-4 text-zinc-400" />
          <span>{t.library.trashBin}</span>
          {trashCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
              {trashCount}
            </span>
          )}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.library.searchPlaceholder}
          className="w-full pl-9 pr-9 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter & Sort Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
        {/* Favorites toggle */}
        <button
          onClick={() => setOnlyFavorites(!onlyFavorites)}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
            onlyFavorites
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
              : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-amber-400 text-amber-400' : ''}`} />
          <span>{t.library.favoritesOnly}</span>
        </button>

        {/* Sort selector */}
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-900/90 text-zinc-400 border border-zinc-800 text-xs font-medium focus:outline-none focus:border-zinc-700 cursor-pointer"
        >
          <option value="date_desc">{t.library.sortDateDesc}</option>
          <option value="date_asc">{t.library.sortDateAsc}</option>
          <option value="title">{t.library.sortTitle}</option>
          <option value="duration_desc">{t.library.sortDurationDesc}</option>
          <option value="duration_asc">{t.library.sortDurationAsc}</option>
        </select>

        {/* Tag pills */}
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              activeTag === tag
                ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                : 'bg-zinc-900/90 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
            }`}
          >
            <TagIcon className="w-3 h-3" />
            <span>{tag}</span>
          </button>
        ))}
      </div>

      {/* Grouped Recordings List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400">
            <FileAudio className="w-12 h-12 text-zinc-600 mb-2 stroke-[1.5]" />
            <span className="font-semibold text-zinc-200">
              {searchQuery ? t.library.emptySearch : t.library.emptyTitle}
            </span>
            <p className="text-xs text-zinc-500 max-w-xs mt-1">
              {searchQuery ? t.library.emptySearchDesc : t.library.emptyDesc}
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.dateKey} className="space-y-2">
              {/* Day Header */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 px-1 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  {group.dateLabel}
                </span>
                <span className="text-zinc-600 font-mono">({group.items.length})</span>
              </div>

              {/* Items in this Day */}
              <div className="space-y-2">
                {group.items.map((rec) => {
                  const isCurrent = activePlayingId === rec.id;
                  const menuOpen = menuOpenId === rec.id;

                  return (
                    <div
                      key={rec.id}
                      onClick={() => onPlayRecording(rec)}
                      className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-zinc-900/95 border-red-500/50 shadow-lg shadow-red-950/20 ring-1 ring-red-500/30'
                          : 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Title & Metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-zinc-100 truncate">
                              {rec.title}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono uppercase">
                              {rec.format}
                            </span>
                          </div>

                          {/* Sub-info: duration, size, time */}
                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-zinc-500" />
                              {formatDuration(rec.durationMs)}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3 text-zinc-500" />
                              {formatFileSize(rec.sizeBytes)}
                            </span>
                            <span className="text-zinc-500">
                              {new Date(rec.createdAt).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Note snippet if present */}
                          {rec.note && (
                            <p className="text-xs text-zinc-400 mt-1.5 italic line-clamp-1">
                              "{rec.note}"
                            </p>
                          )}

                          {/* Tags */}
                          {rec.tags && rec.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {rec.tags.map((tg) => (
                                <span
                                  key={tg}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300 font-medium"
                                >
                                  #{tg}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right Buttons: Favorite & Play/Pause */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onToggleFavorite(rec.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 transition-colors"
                            aria-label="Избранное"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                rec.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                              }`}
                            />
                          </button>

                          <button
                            onClick={() => (isCurrent && isPlaying ? onPauseRecording() : onPlayRecording(rec))}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                              isCurrent && isPlaying
                                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                            }`}
                            aria-label={isCurrent && isPlaying ? 'Пауза' : 'Воспроизвести'}
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>

                          {/* Context menu toggle */}
                          <div className="relative">
                            <button
                              onClick={() => setMenuOpenId(menuOpen ? null : rec.id)}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                              aria-label="Опции"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {menuOpen && (
                              <div className="absolute right-0 top-8 z-30 w-44 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl py-1 text-xs text-zinc-200 animate-fade-in">
                                <button
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onOpenEditor(rec);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-zinc-800 flex items-center gap-2"
                                >
                                  <Scissors className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>{t.library.openInEditor}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onRenameRequest(rec);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-zinc-800 flex items-center gap-2"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>{t.library.rename}</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    setMenuOpenId(null);
                                    handleShare(rec, e);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-zinc-800 flex items-center gap-2"
                                >
                                  <Share2 className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>{t.library.share}</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    setMenuOpenId(null);
                                    handleDownload(rec, e);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-zinc-800 flex items-center gap-2"
                                >
                                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>{t.library.download}</span>
                                </button>
                                <div className="border-t border-zinc-800 my-1" />
                                <button
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onMoveToTrash(rec.id);
                                  }}
                                  className="w-full px-3 py-2 text-left hover:bg-red-950/60 text-red-400 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{t.library.moveToTrash}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mini Waveform Display */}
                      <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center gap-0.5 h-6">
                        {(rec.waveform || []).slice(0, 48).map((peak, idx) => (
                          <div
                            key={idx}
                            className={`w-1 rounded-full transition-all ${
                              isCurrent ? 'bg-red-500/80' : 'bg-zinc-700/60'
                            }`}
                            style={{ height: `${Math.max(15, peak * 100)}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

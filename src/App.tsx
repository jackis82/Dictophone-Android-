import React, { useState, useEffect } from 'react';
import { Mic, ListMusic, Scissors, Settings as SettingsIcon, AlertCircle, RefreshCw } from 'lucide-react';
import { AppSettings, Recording, RecordingState } from './types/index.ts';
import { DEFAULT_SETTINGS, storageService } from './services/storage.ts';
import { audioEngine } from './services/audioEngine.ts';
import { formatAutoTitle } from './utils/recorder-logic.ts';
import { translations } from './i18n/translations.ts';

// Components
import { PhoneShell } from './components/PhoneShell.tsx';
import { RecordTab } from './components/RecordTab.tsx';
import { LibraryTab } from './components/LibraryTab.tsx';
import { EditorTab } from './components/EditorTab.tsx';
import { SettingsTab } from './components/SettingsTab.tsx';
import { SaveTitleDialog } from './components/SaveTitleDialog.tsx';
import { PlayerModal } from './components/PlayerModal.tsx';
import { MiniPlayer } from './components/MiniPlayer.tsx';
import { TrashModal } from './components/TrashModal.tsx';
import { PinLockModal } from './components/PinLockModal.tsx';
import { AndroidApkModal } from './components/AndroidApkModal.tsx';

type Tab = 'record' | 'library' | 'editor' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('record');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLocked, setIsLocked] = useState(false);

  // Crash recovery state (.part journal per FR-6)
  const [crashPart, setCrashPart] = useState<{ id: string; title: string; createdAt: number; format?: string; durationMs?: number } | null>(null);

  // Active audio player state
  const [activeRecording, setActiveRecording] = useState<Recording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosMs, setCurrentPosMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);

  // Save Title Dialog state (FR-4)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<{
    blob: Blob;
    durationMs: number;
    sizeBytes: number;
    waveform: number[];
  } | null>(null);
  const [suggestedTitle, setSuggestedTitle] = useState('');

  // Rename Dialog state (FR-16)
  const [renamingRecording, setRenamingRecording] = useState<Recording | null>(null);

  // Trash modal
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // APK modal
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);

  // Toast alert
  const [toastText, setToastText] = useState<string | null>(null);

  const t = translations[settings.language || 'ru'];

  const showToast = (text: string) => {
    setToastText(text);
    setTimeout(() => setToastText(null), 3000);
  };

  // Initial load
  useEffect(() => {
    const loadedSettings = storageService.getSettings();
    setSettings(loadedSettings);
    if (loadedSettings.pinEnabled && loadedSettings.pinCode) {
      setIsLocked(true);
    }

    // Seed demo recordings and fetch
    storageService.seedDemoRecordingsIfEmpty().then(async (recs) => {
      // populate blob URLs
      for (const r of recs) {
        if (!r.audioBlob) {
          const b = await storageService.getAudioBlob(r.id);
          if (b) {
            r.audioBlob = b;
            r.audioUrl = URL.createObjectURL(b);
          }
        }
      }
      setRecordings([...recs]);
    });

    // Check crash journal .part (FR-6)
    const part = storageService.getCrashPart();
    if (part) {
      setCrashPart(part);
    }
  }, []);

  const refreshRecordings = async () => {
    const list = await storageService.getAllRecordings();
    for (const r of list) {
      if (!r.audioBlob) {
        const b = await storageService.getAudioBlob(r.id);
        if (b) {
          r.audioBlob = b;
          r.audioUrl = URL.createObjectURL(b);
        }
      }
    }
    setRecordings([...list]);
  };

  // Handle when recording is stopped
  const handleFinishedRecording = (result: {
    blob: Blob;
    durationMs: number;
    sizeBytes: number;
    waveform: number[];
  }) => {
    const autoName = formatAutoTitle(settings.namingTemplate, new Date());
    setPendingRecording(result);
    setSuggestedTitle(autoName);
    setIsSaveDialogOpen(true);
  };

  // Save new recording to DB (FR-4)
  const handleCommitTitle = async (titleToSave: string) => {
    if (!pendingRecording) return;
    setIsSaveDialogOpen(false);

    const newId = `rec-${Date.now()}`;
    const newRec: Recording = {
      id: newId,
      title: titleToSave,
      filePath: `/storage/emulated/0/Music/Dictaphone/${titleToSave}.${settings.defaultFormat}`,
      format: settings.defaultFormat,
      sampleRate: 44100,
      channels: settings.stereo ? 2 : 1,
      durationMs: pendingRecording.durationMs,
      sizeBytes: pendingRecording.sizeBytes,
      createdAt: Date.now(),
      isFavorite: false,
      deletedAt: null,
      waveform: pendingRecording.waveform,
      tags: [],
      audioBlob: pendingRecording.blob,
      audioUrl: URL.createObjectURL(pendingRecording.blob),
    };

    await storageService.saveRecording(newRec, pendingRecording.blob);
    storageService.clearCrashPart();
    setPendingRecording(null);
    await refreshRecordings();
    showToast(t.toast.saved);

    // Auto-select and preview newly recorded item
    setActiveRecording(newRec);
  };

  // Play audio
  const handlePlayRecording = (rec: Recording) => {
    setActiveRecording(rec);
    if (!rec.audioUrl && rec.audioBlob) {
      rec.audioUrl = URL.createObjectURL(rec.audioBlob);
    }

    if (rec.audioUrl) {
      audioEngine.playAudio(
        rec.audioUrl,
        rec.id,
        rec.title,
        0,
        1.0,
        (pos, dur, playing) => {
          setCurrentPosMs(pos);
          setDurationMs(dur);
          setIsPlaying(playing);
        }
      );
    }
  };

  const handlePauseRecording = () => {
    audioEngine.pausePlayer();
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    if (!activeRecording) return;
    if (isPlaying) {
      handlePauseRecording();
    } else {
      if (audioEngine.getCurrentPlayingId() === activeRecording.id) {
        audioEngine.resumePlayer();
        setIsPlaying(true);
      } else {
        handlePlayRecording(activeRecording);
      }
    }
  };

  const handleSeek = (posMs: number) => {
    setCurrentPosMs(posMs);
    audioEngine.seekPlayer(posMs);
  };

  const handleToggleFavorite = async (id: string) => {
    const rec = recordings.find((r) => r.id === id);
    if (!rec) return;
    const nextFav = !rec.isFavorite;
    await storageService.updateRecordingMetadata(id, { isFavorite: nextFav });
    await refreshRecordings();
    if (activeRecording?.id === id) {
      setActiveRecording({ ...activeRecording, isFavorite: nextFav });
    }
  };

  const handleMoveToTrash = async (id: string) => {
    await storageService.moveToTrash(id);
    await refreshRecordings();
    showToast(t.toast.deleted);
    if (activeRecording?.id === id) {
      handlePauseRecording();
      setActiveRecording(null);
    }
  };

  const handleRestoreFromTrash = async (id: string) => {
    await storageService.restoreFromTrash(id);
    await refreshRecordings();
    showToast(t.toast.restored);
  };

  const handlePermanentDelete = async (id: string) => {
    await storageService.permanentlyDelete(id);
    await refreshRecordings();
  };

  const handleEmptyAllTrash = async () => {
    const trashItems = recordings.filter((r) => r.deletedAt !== null);
    for (const item of trashItems) {
      await storageService.permanentlyDelete(item.id);
    }
    await refreshRecordings();
  };

  const handleSaveMetadata = async (
    id: string,
    updates: { note?: string; tags?: string[]; isFavorite?: boolean }
  ) => {
    await storageService.updateRecordingMetadata(id, updates);
    await refreshRecordings();
    if (activeRecording?.id === id) {
      setActiveRecording({ ...activeRecording, ...updates });
    }
  };

  const handleSaveNewCopyFromEditor = async (newRec: Recording, blob: Blob) => {
    await storageService.saveRecording(newRec, blob);
    await refreshRecordings();
    showToast(t.toast.saved);
    setActiveRecording(newRec);
    setActiveTab('library');
  };

  const handleRestoreCrashPart = async () => {
    if (!crashPart) return;
    const newRec: Recording = {
      id: `rec-recovered-${Date.now()}`,
      title: `${crashPart.title} (Восстановлено)`,
      filePath: `/storage/emulated/0/Music/Dictaphone/${crashPart.title}.mp3`,
      format: (crashPart.format as any) || 'mp3',
      sampleRate: 44100,
      channels: 2,
      durationMs: 4000,
      sizeBytes: 64000,
      createdAt: crashPart.createdAt || Date.now(),
      isFavorite: false,
      deletedAt: null,
      waveform: Array(80).fill(0.3),
      tags: ['Восстановлено'],
    };
    await storageService.saveRecording(newRec);
    storageService.clearCrashPart();
    setCrashPart(null);
    await refreshRecordings();
    showToast(t.recorder.recoveredNotice);
  };

  const existingActiveTitles = recordings
    .filter((r) => r.deletedAt === null)
    .map((r) => r.title);

  const trashRecordings = recordings.filter((r) => r.deletedAt !== null);

  return (
    <PhoneShell onOpenApkModal={() => setIsApkModalOpen(true)}>
      {/* PIN Lock Screen if protected */}
      {isLocked && (
        <PinLockModal
          isOpen={isLocked}
          correctPin={settings.pinCode}
          lang={settings.language || 'ru'}
          onSuccess={() => setIsLocked(false)}
        />
      )}

      {/* Floating Toast notification */}
      {toastText && (
        <div className="absolute top-12 left-4 right-4 z-50 p-2.5 rounded-xl bg-zinc-800/95 border border-zinc-700 text-white text-xs font-semibold text-center shadow-xl animate-fade-in backdrop-blur-md">
          {toastText}
        </div>
      )}

      {/* Crash Recovery Banner if .part session found (FR-6) */}
      {crashPart && (
        <div className="m-3 p-3 rounded-2xl bg-amber-950/80 border border-amber-800 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold text-white">Обнаружен незавершенный файл</span>
              <span className="text-[10px] text-amber-300 font-mono">
                {crashPart.title} (.part)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRestoreCrashPart}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[11px]"
            >
              Восстановить
            </button>
            <button
              onClick={() => {
                storageService.clearCrashPart();
                setCrashPart(null);
              }}
              className="p-1 rounded-lg hover:bg-amber-900/50 text-amber-400"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Active Tab View */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {activeTab === 'record' && (
          <RecordTab
            settings={settings}
            lang={settings.language || 'ru'}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenApkModal={() => setIsApkModalOpen(true)}
            onFinishedRecording={handleFinishedRecording}
          />
        )}

        {activeTab === 'library' && (
          <LibraryTab
            recordings={recordings}
            activePlayingId={activeRecording?.id || null}
            isPlaying={isPlaying}
            lang={settings.language || 'ru'}
            onPlayRecording={handlePlayRecording}
            onPauseRecording={handlePauseRecording}
            onToggleFavorite={handleToggleFavorite}
            onMoveToTrash={handleMoveToTrash}
            onRenameRequest={(rec) => setRenamingRecording(rec)}
            onOpenEditor={(rec) => {
              setActiveRecording(rec);
              setActiveTab('editor');
            }}
            onOpenTrash={() => setIsTrashOpen(true)}
            trashCount={trashRecordings.length}
          />
        )}

        {activeTab === 'editor' && (
          <EditorTab
            recordings={recordings}
            activeRecording={activeRecording}
            lang={settings.language || 'ru'}
            onSaveNewCopy={handleSaveNewCopyFromEditor}
            onSelectRecording={(rec) => setActiveRecording(rec)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            lang={settings.language || 'ru'}
            onUpdateSettings={(newSettings) => {
              setSettings(newSettings);
              storageService.saveSettings(newSettings);
            }}
            onOpenTrash={() => setIsTrashOpen(true)}
            onOpenApkModal={() => setIsApkModalOpen(true)}
            onImportBackup={async (json) => {
              try {
                const parsed = JSON.parse(json);
                if (parsed.recordings && Array.isArray(parsed.recordings)) {
                  for (const r of parsed.recordings) {
                    await storageService.saveRecording(r);
                  }
                  await refreshRecordings();
                }
              } catch (e) {
                console.error(e);
              }
            }}
          />
        )}
      </div>

      {/* Persistent Mini Player when audio is active */}
      {activeRecording && activeTab !== 'editor' && (
        <MiniPlayer
          recording={activeRecording}
          isPlaying={isPlaying}
          currentPosMs={currentPosMs}
          durationMs={durationMs}
          onTogglePlay={handleTogglePlay}
          onExpand={() => setIsPlayerModalOpen(true)}
        />
      )}

      {/* Android Bottom Navigation Bar */}
      <nav className="w-full h-16 bg-zinc-950/95 border-t border-zinc-800/80 px-2 shrink-0 flex items-center justify-around z-20">
        <button
          onClick={() => setActiveTab('record')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all ${
            activeTab === 'record' ? 'text-red-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label={t.nav.record}
        >
          <Mic className="w-5 h-5" />
          <span className="text-[10px]">{t.nav.record}</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all ${
            activeTab === 'library' ? 'text-red-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label={t.nav.library}
        >
          <ListMusic className="w-5 h-5" />
          <span className="text-[10px]">{t.nav.library}</span>
        </button>

        <button
          onClick={() => setActiveTab('editor')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all ${
            activeTab === 'editor' ? 'text-red-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label={t.nav.editor}
        >
          <Scissors className="w-5 h-5" />
          <span className="text-[10px]">{t.nav.editor}</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all ${
            activeTab === 'settings' ? 'text-red-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          aria-label={t.nav.settings}
        >
          <SettingsIcon className="w-5 h-5" />
          <span className="text-[10px]">{t.nav.settings}</span>
        </button>
      </nav>

      {/* Save Title Dialog (FR-4) */}
      <SaveTitleDialog
        isOpen={isSaveDialogOpen}
        suggestedTitle={suggestedTitle}
        existingTitles={existingActiveTitles}
        lang={settings.language || 'ru'}
        onSave={handleCommitTitle}
        onSaveAuto={() => handleCommitTitle(suggestedTitle)}
      />

      {/* Rename Dialog (FR-16 with duplicate check) */}
      {renamingRecording && (
        <SaveTitleDialog
          isOpen={true}
          suggestedTitle={renamingRecording.title}
          existingTitles={existingActiveTitles.filter((t) => t !== renamingRecording.title)}
          lang={settings.language || 'ru'}
          onSave={async (newTitle) => {
            await storageService.updateRecordingMetadata(renamingRecording.id, {
              title: newTitle,
            });
            setRenamingRecording(null);
            await refreshRecordings();
            showToast(t.toast.renamed);
          }}
          onSaveAuto={() => setRenamingRecording(null)}
        />
      )}

      {/* Full Player Modal Sheet (FR-19, FR-20, FR-21) */}
      {activeRecording && (
        <PlayerModal
          recording={activeRecording}
          isOpen={isPlayerModalOpen}
          isPlaying={isPlaying}
          currentPosMs={currentPosMs}
          durationMs={durationMs}
          lang={settings.language || 'ru'}
          onClose={() => setIsPlayerModalOpen(false)}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onOpenEditor={(rec) => {
            setIsPlayerModalOpen(false);
            setActiveRecording(rec);
            setActiveTab('editor');
          }}
          onSaveMetadata={handleSaveMetadata}
        />
      )}

      {/* Trash Bin Modal (FR-16, 30 days retention) */}
      <TrashModal
        isOpen={isTrashOpen}
        trashRecordings={trashRecordings}
        lang={settings.language || 'ru'}
        onClose={() => setIsTrashOpen(false)}
        onRestore={handleRestoreFromTrash}
        onPermanentDelete={handlePermanentDelete}
        onEmptyAll={handleEmptyAllTrash}
      />

      {/* Android APK Modal */}
      <AndroidApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />
    </PhoneShell>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Volume2,
  Sliders,
  Shield,
  HardDrive,
  Moon,
  Sun,
  Globe,
  Trash2,
  Download,
  Upload,
  Check,
  Radio,
} from 'lucide-react';
import { AppSettings, AUDIO_PROFILES, RecordingFormat, StorageStats } from '../types/index.ts';
import { storageService } from '../services/storage.ts';
import { formatDuration, formatFileSize } from '../utils/recorder-logic.ts';
import { LanguageKey, translations } from '../i18n/translations.ts';

interface SettingsTabProps {
  settings: AppSettings;
  lang: LanguageKey;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onOpenTrash: () => void;
  onOpenApkModal: () => void;
  onImportBackup: (jsonData: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  lang,
  onUpdateSettings,
  onOpenTrash,
  onOpenApkModal,
  onImportBackup,
}) => {
  const [stats, setStats] = useState<StorageStats>({
    totalCount: 0,
    totalDurationMs: 0,
    totalSizeBytes: 0,
    freeSpaceMb: 32000,
  });
  const [pinInput, setPinInput] = useState(settings.pinCode || '');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const t = translations[lang];

  useEffect(() => {
    storageService.getStats().then(setStats);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleFormatChange = (fmt: RecordingFormat) => {
    onUpdateSettings({ ...settings, defaultFormat: fmt });
    showToast(`Формат по умолчанию изменен на ${AUDIO_PROFILES[fmt].name}`);
  };

  const handleExportBackup = async () => {
    const recordings = await storageService.getAllRecordings();
    const backupData = {
      version: 1,
      timestamp: Date.now(),
      settings,
      recordings,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dictophone_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Резервная копия сохранена в файл!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportBackup(content);
        showToast('База успешно импортирована!');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 flex flex-col px-4 py-3 select-none overflow-y-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-zinc-400" />
          {t.settings.title}
        </h1>
      </div>

      {/* APK Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/50 via-zinc-900 to-zinc-900 border border-red-900/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
            APK
          </div>
          <div>
            <span className="text-xs font-bold text-white block">Установка на Android</span>
            <span className="text-[11px] text-zinc-400">WebAPK, прямой экспорт APK через PWABuilder</span>
          </div>
        </div>
        <button
          onClick={onOpenApkModal}
          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-md shadow-red-600/30"
        >
          Скачать APK
        </button>
      </div>

      {toastMsg && (
        <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-white font-medium flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Section 1: Quality & Default Profile (FR-10, FR-37) */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-red-500" />
          {t.settings.qualitySection}
        </h2>

        <div>
          <label className="text-xs font-semibold text-zinc-200 block mb-1">
            {t.settings.defaultFormat}
          </label>
          <p className="text-[11px] text-zinc-400 mb-2">{t.settings.defaultFormatDesc}</p>

          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(AUDIO_PROFILES) as RecordingFormat[]).map((fmt) => {
              const prof = AUDIO_PROFILES[fmt];
              const isSelected = settings.defaultFormat === fmt;
              return (
                <div
                  key={fmt}
                  onClick={() => handleFormatChange(fmt)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-zinc-950 border-red-500/80 shadow-md ring-1 ring-red-500/30'
                      : 'bg-zinc-950/40 border-zinc-800/80 hover:bg-zinc-950/80 hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{prof.name}</span>
                      {prof.isDefault && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-600/30 border border-red-500/40 text-red-300 font-bold">
                          Стандарт
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{prof.description}</p>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {prof.codec} • {prof.bitrate} • {prof.sampleRate / 1000} кГц
                    </span>
                  </div>

                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-red-500 bg-red-500' : 'border-zinc-700'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stereo / Mono Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
          <div>
            <span className="text-xs font-semibold text-zinc-200 block">
              {t.settings.audioChannels}
            </span>
            <span className="text-[11px] text-zinc-400">{t.settings.audioChannelsDesc}</span>
          </div>
          <button
            onClick={() => onUpdateSettings({ ...settings, stereo: !settings.stereo })}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.stereo ? 'bg-red-600' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.stereo ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Section 2: Audio Preamp & Limiter (FR-12, FR-8) */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-red-500" />
          {t.settings.micSection}
        </h2>

        {/* Gain slider */}
        <div>
          <div className="flex justify-between items-center text-xs font-semibold text-zinc-200 mb-1">
            <span>{t.settings.micGain}</span>
            <span className="font-mono text-red-400">{settings.micGain.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={3.0}
            step={0.1}
            value={settings.micGain}
            onChange={(e) =>
              onUpdateSettings({ ...settings, micGain: parseFloat(e.target.value) })
            }
            className="w-full accent-red-500"
          />
        </div>

        {/* Limiter toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
          <span className="text-xs font-semibold text-zinc-200">{t.settings.limiter}</span>
          <button
            onClick={() =>
              onUpdateSettings({ ...settings, limiterEnabled: !settings.limiterEnabled })
            }
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.limiterEnabled ? 'bg-red-600' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.limiterEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* VAD silence trim toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
          <span className="text-xs font-semibold text-zinc-200">{t.settings.vadTrim}</span>
          <button
            onClick={() =>
              onUpdateSettings({ ...settings, vadTrimSilence: !settings.vadTrimSilence })
            }
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.vadTrimSilence ? 'bg-red-600' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.vadTrimSilence ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Section 3: App Appearance & Language (FR-31, FR-32) */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-red-500" />
          {t.settings.appSection}
        </h2>

        {/* Language */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-200">{t.settings.language}</span>
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => onUpdateSettings({ ...settings, language: 'ru' })}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                settings.language === 'ru'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Русский
            </button>
            <button
              onClick={() => onUpdateSettings({ ...settings, language: 'en' })}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                settings.language === 'en'
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Naming Template */}
        <div className="pt-2 border-t border-zinc-800/80">
          <label className="text-xs font-semibold text-zinc-200 block mb-1">
            Шаблон автоимени (FR-4):
          </label>
          <input
            type="text"
            value={settings.namingTemplate}
            onChange={(e) => onUpdateSettings({ ...settings, namingTemplate: e.target.value })}
            className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100"
          />
        </div>
      </div>

      {/* Section 4: Security (PIN) (FR-34) */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-red-500" />
          {t.settings.securitySection}
        </h2>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-200">{t.settings.pinLock}</span>
          <button
            onClick={() => {
              const nextVal = !settings.pinEnabled;
              if (nextVal && !settings.pinCode) {
                setShowPinSetup(true);
              } else {
                onUpdateSettings({ ...settings, pinEnabled: nextVal });
              }
            }}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              settings.pinEnabled ? 'bg-red-600' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.pinEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {showPinSetup && (
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col gap-2">
            <span className="text-xs text-zinc-300 font-medium">Задайте 4-значный PIN-код:</span>
            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="0000"
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-center text-sm font-mono tracking-widest text-white"
            />
            <button
              onClick={() => {
                if (pinInput.length === 4) {
                  onUpdateSettings({ ...settings, pinEnabled: true, pinCode: pinInput });
                  setShowPinSetup(false);
                  showToast('PIN-код сохранен!');
                }
              }}
              disabled={pinInput.length !== 4}
              className="py-1.5 rounded-lg bg-red-600 disabled:opacity-40 text-xs font-semibold text-white"
            >
              Сохранить PIN
            </button>
          </div>
        )}
      </div>

      {/* Section 5: Storage & Statistics (FR-33, FR-35, FR-36) */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-red-500" />
          {t.settings.storageSection}
        </h2>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">{t.settings.totalRecordings}</span>
            <span className="text-base font-bold text-white font-mono">{stats.totalCount}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">{t.settings.totalDuration}</span>
            <span className="text-base font-bold text-white font-mono">
              {formatDuration(stats.totalDurationMs)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">{t.settings.totalSize}</span>
            <span className="text-base font-bold text-white font-mono">
              {formatFileSize(stats.totalSizeBytes)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 block">{t.settings.freeSpace}</span>
            <span className="text-base font-bold text-emerald-400 font-mono">
              {(stats.freeSpaceMb / 1024).toFixed(1)} ГБ
            </span>
          </div>
        </div>

        <div className="pt-2 text-xs text-zinc-400">
          <span className="block font-semibold text-zinc-300">{t.settings.storageDir}:</span>
          <span className="font-mono text-[11px] text-zinc-500">{settings.storageDir}</span>
        </div>

        {/* Backup Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
          <button
            onClick={handleExportBackup}
            className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.settings.backupExport}</span>
          </button>

          <label className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center">
            <Upload className="w-3.5 h-3.5" />
            <span>{t.settings.backupImport}</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>

        {/* Trash Launcher */}
        <div className="pt-2">
          <button
            onClick={onOpenTrash}
            className="w-full py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-950/60 border border-red-900/50 text-xs font-semibold text-red-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.settings.openTrash} (хранилище 30 дней)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

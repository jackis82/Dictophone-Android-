import { AppSettings, Recording, StorageStats } from '../types/index.ts';
import { calculateTrashExpiry } from '../utils/recorder-logic.ts';
import { encodeMp3, extractWaveform, generateSyntheticVoiceBuffer } from './audioEncoder.ts';

const DB_NAME = 'dictophone_android_db';
const DB_VERSION = 1;
const STORE_RECORDINGS = 'recordings_metadata';
const STORE_AUDIO_BLOBS = 'audio_blobs';
const SETTINGS_KEY = 'dictophone_settings';
const CRASH_SESSION_KEY = 'dictophone_crash_recovery_part';

export const DEFAULT_SETTINGS: AppSettings = {
  defaultFormat: 'mp3', // FR-10 & FR-37: MP3 128 kbps CBR by default
  namingTemplate: 'Запись {YYYY}-{MM}-{DD} {HH}-{mm}-{ss}',
  stereo: true,
  micGain: 1.0,
  limiterEnabled: true,
  vadTrimSilence: false,
  callBehavior: 'pause',
  theme: 'dark',
  language: 'ru',
  pinEnabled: false,
  pinCode: '',
  storageDir: 'Внутреннее хранилище / Music / Dictaphone',
};

class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryAudioMap: Map<string, Blob> = new Map();

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
            db.createObjectStore(STORE_RECORDINGS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_AUDIO_BLOBS)) {
            db.createObjectStore(STORE_AUDIO_BLOBS, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  // --- Settings ---
  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (data) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  }

  saveSettings(settings: AppSettings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }

  // --- Crash Recovery (.part) FR-6 ---
  saveCrashPart(session: { id: string; title: string; createdAt: number; format: string; durationMs: number }) {
    try {
      localStorage.setItem(CRASH_SESSION_KEY, JSON.stringify(session));
    } catch {}
  }

  getCrashPart(): { id: string; title: string; createdAt: number; format: string; durationMs: number } | null {
    try {
      const data = localStorage.getItem(CRASH_SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  clearCrashPart() {
    try {
      localStorage.removeItem(CRASH_SESSION_KEY);
    } catch {}
  }

  // --- Recordings Metadata & Audio Blobs ---
  async getAllRecordings(): Promise<Recording[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RECORDINGS, 'readonly');
        const store = tx.objectStore(STORE_RECORDINGS);
        const req = store.getAll();
        req.onsuccess = () => {
          const items: Recording[] = req.result || [];
          resolve(items);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('Failed to read recordings from IndexedDB, falling back', e);
      return [];
    }
  }

  async saveRecording(recording: Recording, audioBlob?: Blob): Promise<void> {
    const db = await this.getDB();
    if (audioBlob) {
      this.memoryAudioMap.set(recording.id, audioBlob);
      // store in indexedDB audio_blobs
      const blobTx = db.transaction(STORE_AUDIO_BLOBS, 'readwrite');
      const blobStore = blobTx.objectStore(STORE_AUDIO_BLOBS);
      blobStore.put({ id: recording.id, blob: audioBlob });
    }

    // Clone recording object without audioBlob/audioUrl to avoid IDB clone errors
    const { audioBlob: _b, audioUrl: _u, ...meta } = recording;
    const tx = db.transaction(STORE_RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    store.put(meta);
  }

  async getAudioBlob(recordingId: string): Promise<Blob | null> {
    if (this.memoryAudioMap.has(recordingId)) {
      return this.memoryAudioMap.get(recordingId)!;
    }
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_AUDIO_BLOBS, 'readonly');
        const store = tx.objectStore(STORE_AUDIO_BLOBS);
        const req = store.get(recordingId);
        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            this.memoryAudioMap.set(recordingId, req.result.blob);
            resolve(req.result.blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async updateRecordingMetadata(id: string, updates: Partial<Recording>): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORE_RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    const req = store.get(id);
    req.onsuccess = () => {
      if (req.result) {
        const updated = { ...req.result, ...updates };
        store.put(updated);
      }
    };
  }

  async moveToTrash(id: string): Promise<void> {
    await this.updateRecordingMetadata(id, { deletedAt: Date.now() });
  }

  async restoreFromTrash(id: string): Promise<void> {
    await this.updateRecordingMetadata(id, { deletedAt: null });
  }

  async permanentlyDelete(id: string): Promise<void> {
    const db = await this.getDB();
    this.memoryAudioMap.delete(id);
    const tx = db.transaction([STORE_RECORDINGS, STORE_AUDIO_BLOBS], 'readwrite');
    tx.objectStore(STORE_RECORDINGS).delete(id);
    tx.objectStore(STORE_AUDIO_BLOBS).delete(id);
  }

  async purgeExpiredTrash(retentionDays: number = 30): Promise<number> {
    const recordings = await this.getAllRecordings();
    let purgedCount = 0;
    for (const rec of recordings) {
      if (rec.deletedAt !== null) {
        const { isExpired } = calculateTrashExpiry(rec.deletedAt, retentionDays);
        if (isExpired) {
          await this.permanentlyDelete(rec.id);
          purgedCount++;
        }
      }
    }
    return purgedCount;
  }

  async getStats(): Promise<StorageStats> {
    const recordings = await this.getAllRecordings();
    const active = recordings.filter((r) => r.deletedAt === null);
    const totalDurationMs = active.reduce((acc, r) => acc + r.durationMs, 0);
    const totalSizeBytes = active.reduce((acc, r) => acc + r.sizeBytes, 0);

    return {
      totalCount: active.length,
      totalDurationMs,
      totalSizeBytes,
      freeSpaceMb: 32450, // Simulated Android device storage free space
    };
  }

  /**
   * Initializes demo recordings so the user immediately has realistic files to play, search, and edit
   */
  async seedDemoRecordingsIfEmpty(): Promise<Recording[]> {
    const current = await this.getAllRecordings();
    if (current.length > 0) return current;

    // Generate real demo MP3 recordings
    const demo1Audio = generateSyntheticVoiceBuffer(6.5, 44100);
    const demo1Blob = encodeMp3(demo1Audio.left, demo1Audio.right, 44100, 128);
    const demo1Waveform = extractWaveform(demo1Audio.left, 80);

    const demo2Audio = generateSyntheticVoiceBuffer(4.2, 44100);
    const demo2Blob = encodeMp3(demo2Audio.left, demo2Audio.right, 44100, 128);
    const demo2Waveform = extractWaveform(demo2Audio.left, 80);

    const now = Date.now();
    const rec1: Recording = {
      id: 'demo-rec-1',
      title: 'Интервью и вводный инструктаж',
      filePath: '/storage/emulated/0/Music/Dictaphone/Интервью и вводный инструктаж.mp3',
      format: 'mp3',
      sampleRate: 44100,
      channels: 2,
      durationMs: 6500,
      sizeBytes: demo1Blob.size,
      createdAt: now - 3600 * 1000 * 2, // 2 hours ago
      note: 'Важные указания по архитектуре аудио-ядра и проверке NFR.',
      isFavorite: true,
      deletedAt: null,
      waveform: demo1Waveform,
      tags: ['Работа', 'Инструктаж'],
    };

    const rec2: Recording = {
      id: 'demo-rec-2',
      title: 'Идея релиза диктофона v1',
      filePath: '/storage/emulated/0/Music/Dictaphone/Идея релиза диктофона v1.mp3',
      format: 'mp3',
      sampleRate: 44100,
      channels: 2,
      durationMs: 4200,
      sizeBytes: demo2Blob.size,
      createdAt: now - 3600 * 1000 * 24, // Yesterday
      note: 'Проверить работу фонового сервиса и автоматическое сохранение.',
      isFavorite: false,
      deletedAt: null,
      waveform: demo2Waveform,
      tags: ['Идеи'],
    };

    await this.saveRecording(rec1, demo1Blob);
    await this.saveRecording(rec2, demo2Blob);

    return [rec1, rec2];
  }
}

export const storageService = new StorageService();

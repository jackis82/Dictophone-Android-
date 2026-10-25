export type RecordingFormat = 'mp3' | 'aac' | 'flac' | 'opus' | 'wav';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopping';

export interface AudioProfile {
  id: RecordingFormat;
  name: string;
  codec: string;
  bitrate: string;
  sampleRate: number;
  channels: number;
  extension: string;
  isDefault?: boolean;
  description: string;
}

export const AUDIO_PROFILES: Record<RecordingFormat, AudioProfile> = {
  mp3: {
    id: 'mp3',
    name: 'MP3 (По умолчанию)',
    codec: 'MPEG-1 Layer 3 (CBR)',
    bitrate: '128 кбит/с',
    sampleRate: 44100,
    channels: 2,
    extension: '.mp3',
    isDefault: true,
    description: 'Универсальный формат, максимальная совместимость',
  },
  flac: {
    id: 'flac',
    name: 'Высокое (FLAC)',
    codec: 'FLAC Lossless',
    bitrate: 'Lossless',
    sampleRate: 48000,
    channels: 2,
    extension: '.flac',
    description: 'Для интервью и музыки без потерь качества',
  },
  aac: {
    id: 'aac',
    name: 'Стандарт (AAC)',
    codec: 'AAC-LC',
    bitrate: '128 кбит/с',
    sampleRate: 44100,
    channels: 2,
    extension: '.m4a',
    description: 'Компактный размер без потери качества',
  },
  opus: {
    id: 'opus',
    name: 'Экономный (Opus)',
    codec: 'Opus Voice',
    bitrate: '32 кбит/с',
    sampleRate: 48000,
    channels: 1,
    extension: '.ogg',
    description: 'Голосовые заметки минимального размера',
  },
  wav: {
    id: 'wav',
    name: 'Совместимый (WAV)',
    codec: 'PCM 16-bit',
    bitrate: '1411 кбит/с',
    sampleRate: 44100,
    channels: 2,
    extension: '.wav',
    description: 'Чистый звук без сжатия для студийного монтажа',
  },
};

export interface Recording {
  id: string;
  title: string;
  filePath: string;
  format: RecordingFormat;
  sampleRate: number;
  channels: number;
  durationMs: number;
  sizeBytes: number;
  createdAt: number; // Unix timestamp in ms
  note?: string;
  isFavorite: boolean;
  deletedAt: number | null; // null if active, ms if in trash
  waveform: number[]; // 0.0 to 1.0 normalized peaks
  tags: string[];
  audioBlob?: Blob;
  audioUrl?: string;
}

export interface AppSettings {
  defaultFormat: RecordingFormat;
  namingTemplate: string; // e.g. "Запись {YYYY}-{MM}-{DD} {HH}-{mm}-{ss}"
  stereo: boolean;
  micGain: number; // 0.5 to 3.0
  limiterEnabled: boolean;
  vadTrimSilence: boolean;
  callBehavior: 'pause' | 'continue';
  theme: 'dark' | 'light' | 'system';
  language: 'ru' | 'en';
  pinEnabled: boolean;
  pinCode: string;
  storageDir: string;
}

export interface StorageStats {
  totalCount: number;
  totalDurationMs: number;
  totalSizeBytes: number;
  freeSpaceMb: number;
}

export type SortField = 'date_desc' | 'date_asc' | 'title' | 'duration_desc' | 'duration_asc';

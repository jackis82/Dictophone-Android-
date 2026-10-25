import { Recording, SortField } from '../types/index.ts';

/**
 * Forbidden characters in file titles per FR-4: / \ : * ? " < > |
 */
export const FORBIDDEN_CHARS_REGEX = /[/\\:*?"<>|]/;

export interface TitleValidationResult {
  valid: boolean;
  code?: 'E_NAME_EXISTS' | 'E_NAME_INVALID';
  message?: string;
  suggestion?: string;
}

/**
 * Validates recording title according to FR-4:
 * - 1 to 100 characters
 * - No forbidden characters / \ : * ? " < > |
 * - Leading/trailing spaces trimmed automatically
 * - Spaces-only rejected
 * - Must be unique among active recordings
 */
export function validateTitle(
  rawTitle: string,
  existingActiveTitles: string[],
  currentId?: string
): TitleValidationResult {
  const trimmed = rawTitle.trim();

  if (!trimmed || trimmed.length === 0) {
    return {
      valid: false,
      code: 'E_NAME_INVALID',
      message: 'Имя записи не может быть пустым или состоять только из пробелов.',
    };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      code: 'E_NAME_INVALID',
      message: 'Имя записи не должно превышать 100 символов.',
    };
  }

  if (FORBIDDEN_CHARS_REGEX.test(trimmed)) {
    return {
      valid: false,
      code: 'E_NAME_INVALID',
      message: 'Имя содержит недопустимые символы: / \\ : * ? " < > |',
    };
  }

  const isDuplicate = existingActiveTitles.some(
    (existing) => existing.toLowerCase() === trimmed.toLowerCase()
  );

  if (isDuplicate) {
    const suggestion = suggestUniqueTitle(trimmed, existingActiveTitles);
    return {
      valid: false,
      code: 'E_NAME_EXISTS',
      message: 'Запись с таким именем уже существует.',
      suggestion,
    };
  }

  return { valid: true };
}

/**
 * Suggests the next available unique title: "Имя (2)", "Имя (3)", etc.
 */
export function suggestUniqueTitle(baseTitle: string, existingTitles: string[]): string {
  const cleanBase = baseTitle.trim().replace(/\s*\(\d+\)$/, '');
  const lowerTitles = new Set(existingTitles.map((t) => t.toLowerCase()));

  let counter = 2;
  while (true) {
    const candidate = `${cleanBase} (${counter})`;
    if (!lowerTitles.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter++;
  }
}

/**
 * Formats an auto-generated title using template and date.
 * Default template: "Запись {YYYY}-{MM}-{DD} {HH}-{mm}-{ss}"
 */
export function formatAutoTitle(template: string = 'Запись {YYYY}-{MM}-{DD} {HH}-{mm}-{ss}', date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const YYYY = date.getFullYear().toString();
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  return template
    .replace('{YYYY}', YYYY)
    .replace('{MM}', MM)
    .replace('{DD}', DD)
    .replace('{HH}', HH)
    .replace('{mm}', mm)
    .replace('{ss}', ss);
}

/**
 * Formats duration in milliseconds into mm:ss or hh:mm:ss
 */
export function formatDuration(ms: number): string {
  if (!ms || isNaN(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formats duration with tenths of a second for live recording timer: 00:00.0
 */
export function formatLiveTimer(ms: number): { time: string; tenths: string } {
  if (!ms || isNaN(ms) || ms < 0) return { time: '00:00', tenths: '.0' };
  const totalSeconds = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  const time = hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return { time, tenths: `.${tenths}` };
}

/**
 * Formats file size in bytes to human-readable string (KB, MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 КБ';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

/**
 * Calculates trash retention expiry (30 days per FR-16)
 */
export function calculateTrashExpiry(deletedAt: number | null, retentionDays: number = 30, currentTime: number = Date.now()) {
  if (deletedAt === null) {
    return { inTrash: false, daysLeft: 0, isExpired: false };
  }
  const expiryTime = deletedAt + retentionDays * 24 * 60 * 60 * 1000;
  const msLeft = expiryTime - currentTime;
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

  return {
    inTrash: true,
    daysLeft,
    isExpired: msLeft <= 0,
  };
}

/**
 * Filters and sorts recordings
 */
export function filterAndSortRecordings(
  recordings: Recording[],
  options: {
    query?: string;
    sort?: SortField;
    activeTag?: string | null;
    onlyFavorites?: boolean;
    includeTrash?: boolean;
  }
): Recording[] {
  const { query = '', sort = 'date_desc', activeTag = null, onlyFavorites = false, includeTrash = false } = options;
  const cleanQuery = query.trim().toLowerCase();

  return recordings
    .filter((rec) => {
      // Trash filter
      if (includeTrash) {
        if (rec.deletedAt === null) return false;
      } else {
        if (rec.deletedAt !== null) return false;
      }

      // Favorites
      if (onlyFavorites && !rec.isFavorite) return false;

      // Tag filter
      if (activeTag && !rec.tags.includes(activeTag)) return false;

      // Query filter (matches title, note, tags)
      if (cleanQuery) {
        const matchesTitle = rec.title.toLowerCase().includes(cleanQuery);
        const matchesNote = (rec.note || '').toLowerCase().includes(cleanQuery);
        const matchesTags = rec.tags.some((t) => t.toLowerCase().includes(cleanQuery));
        if (!matchesTitle && !matchesNote && !matchesTags) return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case 'date_desc':
          return b.createdAt - a.createdAt;
        case 'date_asc':
          return a.createdAt - b.createdAt;
        case 'title':
          return a.title.localeCompare(b.title, 'ru');
        case 'duration_desc':
          return b.durationMs - a.durationMs;
        case 'duration_asc':
          return a.durationMs - b.durationMs;
        default:
          return b.createdAt - a.createdAt;
      }
    });
}

/**
 * Groups recordings by day (FR-14)
 */
export function groupRecordingsByDate(
  recordings: Recording[],
  labels: { today: string; yesterday: string } = { today: 'Сегодня', yesterday: 'Вчера' }
): { dateKey: string; dateLabel: string; items: Recording[] }[] {
  const groups: Map<string, { dateLabel: string; items: Recording[]; timestamp: number }> = new Map();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

  for (const rec of recordings) {
    const d = new Date(rec.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

    let dateLabel: string;
    if (dayKey === todayStr) {
      dateLabel = labels.today;
    } else if (dayKey === yesterdayStr) {
      dateLabel = labels.yesterday;
    } else {
      dateLabel = d.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }

    if (!groups.has(dayKey)) {
      groups.set(dayKey, {
        dateLabel,
        items: [],
        timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
      });
    }

    groups.get(dayKey)!.items.push(rec);
  }

  // Sort groups descending by date
  return Array.from(groups.entries())
    .sort(([, a], [, b]) => b.timestamp - a.timestamp)
    .map(([dateKey, val]) => ({
      dateKey,
      dateLabel: val.dateLabel,
      items: val.items,
    }));
}

/**
 * Trims audio channel samples non-destructively: cuts head and tail
 */
export function trimAudioChannel(
  channelData: Float32Array,
  sampleRate: number,
  startSec: number,
  endSec: number
): Float32Array {
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(channelData.length, Math.floor(endSec * sampleRate));
  if (startSample >= endSample) {
    return new Float32Array(0);
  }
  return channelData.slice(startSample, endSample);
}

/**
 * Cuts a segment from audio channel data (FR-26)
 */
export function cutAudioChannelSegment(
  channelData: Float32Array,
  sampleRate: number,
  cutStartSec: number,
  cutEndSec: number
): Float32Array {
  const cutStart = Math.max(0, Math.floor(cutStartSec * sampleRate));
  const cutEnd = Math.min(channelData.length, Math.floor(cutEndSec * sampleRate));

  if (cutStart >= cutEnd) return channelData.slice();

  const part1 = channelData.slice(0, cutStart);
  const part2 = channelData.slice(cutEnd);

  const result = new Float32Array(part1.length + part2.length);
  result.set(part1, 0);
  result.set(part2, part1.length);
  return result;
}

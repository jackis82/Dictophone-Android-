import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTitle,
  suggestUniqueTitle,
  formatAutoTitle,
  formatDuration,
  formatLiveTimer,
  formatFileSize,
  calculateTrashExpiry,
  filterAndSortRecordings,
  groupRecordingsByDate,
  trimAudioChannel,
  cutAudioChannelSegment,
} from './recorder-logic.ts';
import { Recording } from '../types/index.ts';

test('validateTitle rejects empty or whitespace-only names', () => {
  const result1 = validateTitle('', []);
  assert.equal(result1.valid, false);
  assert.equal(result1.code, 'E_NAME_INVALID');

  const result2 = validateTitle('     ', []);
  assert.equal(result2.valid, false);
  assert.equal(result2.code, 'E_NAME_INVALID');
});

test('validateTitle rejects forbidden characters per FR-4', () => {
  const forbidden = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
  for (const char of forbidden) {
    const result = validateTitle(`Тест ${char} запись`, []);
    assert.equal(result.valid, false, `Should reject ${char}`);
    assert.equal(result.code, 'E_NAME_INVALID');
  }
});

test('validateTitle rejects names over 100 characters', () => {
  const longName = 'A'.repeat(101);
  const result = validateTitle(longName, []);
  assert.equal(result.valid, false);
  assert.equal(result.code, 'E_NAME_INVALID');
});

test('validateTitle detects existing names and suggests alternative', () => {
  const existing = ['Запись 1', 'Запись 2026-10-25 10-00-00'];
  const result = validateTitle('Запись 1', existing);
  assert.equal(result.valid, false);
  assert.equal(result.code, 'E_NAME_EXISTS');
  assert.equal(result.suggestion, 'Запись 1 (2)');

  const resultCase = validateTitle('запись 1', existing);
  assert.equal(resultCase.valid, false);
  assert.equal(resultCase.code, 'E_NAME_EXISTS');
});

test('suggestUniqueTitle increments correctly', () => {
  const existing = ['Лекция', 'Лекция (2)', 'Лекция (3)'];
  const suggestion = suggestUniqueTitle('Лекция', existing);
  assert.equal(suggestion, 'Лекция (4)');

  const suggestionFromNumbered = suggestUniqueTitle('Лекция (2)', existing);
  assert.equal(suggestionFromNumbered, 'Лекция (4)');
});

test('formatAutoTitle replaces template placeholders', () => {
  const fixedDate = new Date(2026, 9, 25, 14, 30, 45); // Oct 25, 2026 14:30:45
  const title = formatAutoTitle('Запись {YYYY}-{MM}-{DD} {HH}-{mm}-{ss}', fixedDate);
  assert.equal(title, 'Запись 2026-10-25 14-30-45');
});

test('formatDuration formats mm:ss and hh:mm:ss properly', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(5000), '00:05');
  assert.equal(formatDuration(65000), '01:05');
  assert.equal(formatDuration(3665000), '01:01:05');
});

test('formatLiveTimer returns time and tenths', () => {
  const { time, tenths } = formatLiveTimer(1250);
  assert.equal(time, '00:01');
  assert.equal(tenths, '.2');
});

test('formatFileSize formats human-readable units', () => {
  assert.equal(formatFileSize(0), '0 КБ');
  assert.equal(formatFileSize(500), '500 Б');
  assert.equal(formatFileSize(1024 * 50), '50.0 КБ');
  assert.equal(formatFileSize(1024 * 1024 * 2.5), '2.50 МБ');
});

test('calculateTrashExpiry calculates 30-day countdown correctly', () => {
  const now = 1700000000000;
  const deletedYesterday = now - 24 * 60 * 60 * 1000;
  const info = calculateTrashExpiry(deletedYesterday, 30, now);
  assert.equal(info.inTrash, true);
  assert.equal(info.daysLeft, 29);
  assert.equal(info.isExpired, false);

  const deleted31DaysAgo = now - 31 * 24 * 60 * 60 * 1000;
  const expired = calculateTrashExpiry(deleted31DaysAgo, 30, now);
  assert.equal(expired.inTrash, true);
  assert.equal(expired.daysLeft, 0);
  assert.equal(expired.isExpired, true);
});

test('filterAndSortRecordings filters by query, tag, favorite, and sort', () => {
  const items: Recording[] = [
    {
      id: '1',
      title: 'Интервью с инженером',
      filePath: '/rec/1.mp3',
      format: 'mp3',
      sampleRate: 44100,
      channels: 2,
      durationMs: 120000,
      sizeBytes: 1920000,
      createdAt: 1000,
      isFavorite: true,
      deletedAt: null,
      waveform: [0.1, 0.5, 0.2],
      tags: ['Работа', 'Интервью'],
    },
    {
      id: '2',
      title: 'Голосовая заметка',
      filePath: '/rec/2.mp3',
      format: 'mp3',
      sampleRate: 44100,
      channels: 2,
      durationMs: 30000,
      sizeBytes: 480000,
      createdAt: 2000,
      isFavorite: false,
      deletedAt: null,
      waveform: [0.2, 0.3],
      tags: ['Личное'],
    },
    {
      id: '3',
      title: 'Удаленный файл',
      filePath: '/rec/3.mp3',
      format: 'mp3',
      sampleRate: 44100,
      channels: 2,
      durationMs: 10000,
      sizeBytes: 160000,
      createdAt: 3000,
      isFavorite: false,
      deletedAt: 5000,
      waveform: [0.1],
      tags: [],
    },
  ];

  // Active only by default
  const active = filterAndSortRecordings(items, {});
  assert.equal(active.length, 2);
  assert.equal(active[0].id, '2'); // sorted by date desc

  // Search
  const searched = filterAndSortRecordings(items, { query: 'инженер' });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].id, '1');

  // Favorites
  const favs = filterAndSortRecordings(items, { onlyFavorites: true });
  assert.equal(favs.length, 1);
  assert.equal(favs[0].id, '1');

  // Tag filter
  const tagged = filterAndSortRecordings(items, { activeTag: 'Личное' });
  assert.equal(tagged.length, 1);
  assert.equal(tagged[0].id, '2');

  // Trash only
  const trash = filterAndSortRecordings(items, { includeTrash: true });
  assert.equal(trash.length, 1);
  assert.equal(trash[0].id, '3');
});

test('trimAudioChannel slices start and end seconds', () => {
  const sampleRate = 10;
  const channelData = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); // 1 second
  // trim from 0.2s to 0.6s -> samples 2 to 6
  const trimmed = trimAudioChannel(channelData, sampleRate, 0.2, 0.6);
  assert.equal(trimmed.length, 4);
  assert.equal(trimmed[0], 2);
  assert.equal(trimmed[3], 5);
});

test('cutAudioChannelSegment cuts middle segment', () => {
  const sampleRate = 10;
  const channelData = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  // cut from 0.3s to 0.7s (samples 3, 4, 5, 6)
  const cut = cutAudioChannelSegment(channelData, sampleRate, 0.3, 0.7);
  assert.equal(cut.length, 6);
  assert.deepEqual(Array.from(cut), [0, 1, 2, 7, 8, 9]);
});

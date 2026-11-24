import Dexie from 'dexie';

export const db = new Dexie('BiNhiHSKDatabase');

db.version(1).stores({
  // Shared vocabulary dictionary (4,605+ default HSK 3.0 entries + imported/AI saved words)
  vocab: 'id, level, hanzi, pinyin, createdAt',
  // Per-profile SM-2 spaced repetition state (key: `${profileId}::${vocabId}`)
  reviews: 'key, profileId, vocabId, level, nextReviewDate, status',
  // Per-profile Arcade high scores & time records
  gameScores: '++id, profileId, game, levelKey, score, timeMs, createdAt',
  // Per-profile Practice Quiz & Real Exam Simulation history
  examHistory: '++id, profileId, examId, mode, level, totalScore, passed, createdAt',
  // Shared custom imported mock exams
  customExams: 'id, level, title, createdAt',
  // Per-profile AI translation & sentence grading journal
  translationLogs: '++id, profileId, mode, direction, level, score, createdAt',
  // Metadata (e.g. seed version)
  meta: 'key',
});

db.version(2).stores({
  vocab: 'id, level, hanzi, pinyin, createdAt',
  reviews: 'key, profileId, vocabId, level, nextReviewDate, status',
  gameScores: '++id, profileId, game, levelKey, score, timeMs, createdAt',
  examHistory: '++id, profileId, examId, mode, level, totalScore, passed, createdAt',
  customExams: 'id, level, title, createdAt',
  translationLogs: '++id, profileId, mode, direction, level, score, createdAt',
  meta: 'key',
  // Per-profile personal flashcard decks & cards
  customDecks: 'id, profileId, name, createdAt',
  customCards: 'id, profileId, deckId, hanzi, createdAt',
});

export function reviewKey(profileId, vocabId) {
  return `${profileId}::${vocabId}`;
}

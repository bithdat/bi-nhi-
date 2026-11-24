const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SM-2 Spaced Repetition tailored to 3 intuitive ratings:
 * - 'forgot' (Quên): review immediately in current session (interval = 0)
 * - 'vague'  (Nhớ mang máng): review after 1 day
 * - 'known'  (Đã thuộc): 3 days -> 5 days -> 7+ days via SM-2 easeFactor
 */
export function computeSM2(prev, rating) {
  const now = Date.now();
  const prevEase = prev?.easeFactor ?? 2.5;
  const prevReps = prev?.repetitions ?? 0;
  const prevInterval = prev?.interval ?? 0;

  if (rating === 'forgot') {
    return {
      interval: 0,
      repetitions: 0,
      easeFactor: Math.max(1.3, prevEase - 0.2),
      nextReviewDate: now, // due immediately
      lastReviewedAt: now,
      status: 'learning',
    };
  }

  if (rating === 'vague') {
    const interval = 1;
    return {
      interval,
      repetitions: Math.max(1, prevReps),
      easeFactor: Math.max(1.3, prevEase - 0.1),
      nextReviewDate: now + interval * DAY_MS,
      lastReviewedAt: now,
      status: 'learning',
    };
  }

  // 'known' (Đã thuộc)
  const repetitions = prevReps + 1;
  let interval;
  if (repetitions === 1) {
    interval = 3;
  } else if (repetitions === 2) {
    interval = 6;
  } else {
    interval = Math.max(7, Math.round(prevInterval * prevEase));
  }

  const easeFactor = Math.min(2.8, prevEase + 0.1);
  return {
    interval,
    repetitions,
    easeFactor,
    nextReviewDate: now + interval * DAY_MS,
    lastReviewedAt: now,
    status: 'mastered',
  };
}

export function formatIntervalLabel(days) {
  if (days <= 0) return 'Ôn ngay';
  if (days === 1) return '1 ngày';
  return `${days} ngày`;
}

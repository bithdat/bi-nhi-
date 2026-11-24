import { db } from './database';

const VOCAB_SEED_VERSION = 'hsk30-v1-4605';
const EXAMS_SEED_VERSION = 'exams-v1-6levels';

let seedPromise = null;

export async function ensureSeeded() {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const [vocabMeta, vocabCount] = await Promise.all([
      db.meta.get('vocabSeedVersion'),
      db.vocab.count(),
    ]);

    if (!vocabMeta || vocabMeta.value !== VOCAB_SEED_VERSION || vocabCount === 0) {
      const res = await fetch('/data/defaultVocab.json');
      if (!res.ok) throw new Error('Không thể tải bộ dữ liệu từ vựng mặc định.');
      const list = await res.json();
      const now = Date.now();
      const enriched = list.map((item) => ({
        ...item,
        createdAt: item.createdAt || now,
      }));
      await db.transaction('rw', db.vocab, db.meta, async () => {
        await db.vocab.bulkPut(enriched);
        await db.meta.put({ key: 'vocabSeedVersion', value: VOCAB_SEED_VERSION });
      });
    }

    const examsMeta = await db.meta.get('examsSeedVersion');
    if (!examsMeta || examsMeta.value !== EXAMS_SEED_VERSION) {
      const res = await fetch('/data/defaultExams.json');
      if (res.ok) {
        const exams = await res.json();
        await db.meta.put({ key: 'defaultExamsCache', value: exams });
        await db.meta.put({ key: 'examsSeedVersion', value: EXAMS_SEED_VERSION });
      }
    }
  })().catch((err) => {
    seedPromise = null;
    throw err;
  });

  return seedPromise;
}

export async function getAllExams() {
  await ensureSeeded();
  const cached = await db.meta.get('defaultExamsCache');
  const defaults = Array.isArray(cached?.value) ? cached.value : [];
  const customs = await db.customExams.toArray();
  return [...defaults, ...customs];
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Timer, RotateCcw, Trophy } from 'lucide-react';
import { db } from '../../db/database';
import { useApp } from '../../context/AppContext';
import { speakChinese } from '../../utils/speech';

export function WordMatch() {
  const { activeProfileId, targetLevels, speechRate, recordStudyActivity } = useApp();

  const [pairCount, setPairCount] = useState(6); // 6 pairs (12 cards) | 8 pairs (16 cards)
  const [leftType, setLeftType] = useState('hanzi'); // 'hanzi' | 'pinyin'
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState([]);
  const [matchedPairIds, setMatchedPairIds] = useState(new Set());
  const [wrongIds, setWrongIds] = useState(new Set());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const startRound = useCallback(async () => {
    clearInterval(timerRef.current);
    setFinished(false);
    setSelected([]);
    setMatchedPairIds(new Set());
    setWrongIds(new Set());
    setElapsedMs(0);

    const pool = await db.vocab.where('level').anyOf(targetLevels).toArray();
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, pairCount);

    const deck = [];
    shuffled.forEach((w) => {
      deck.push({
        uid: `${w.id}-zh`,
        pairId: w.id,
        side: 'zh',
        label: leftType === 'pinyin' ? w.pinyin : w.hanzi,
        hanzi: w.hanzi,
      });
      deck.push({
        uid: `${w.id}-vi`,
        pairId: w.id,
        side: 'vi',
        label: w.meaning,
        hanzi: w.hanzi,
      });
    });

    setCards(deck.sort(() => Math.random() - 0.5));
    startTimeRef.current = performance.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - startTimeRef.current));
    }, 100);
  }, [targetLevels.join(','), pairCount, leftType]);

  useEffect(() => {
    startRound();
    return () => clearInterval(timerRef.current);
  }, [startRound]);

  const handleCardClick = (card) => {
    if (finished || matchedPairIds.has(card.pairId) || wrongIds.size > 0) return;
    if (selected.some((c) => c.uid === card.uid)) {
      setSelected([]);
      return;
    }

    if (card.side === 'zh') {
      speakChinese(card.hanzi, speechRate);
    }

    const nextSelected = [...selected, card];
    setSelected(nextSelected);

    if (nextSelected.length === 2) {
      const [first, second] = nextSelected;
      if (first.pairId === second.pairId && first.side !== second.side) {
        const nextMatched = new Set(matchedPairIds);
        nextMatched.add(first.pairId);
        setMatchedPairIds(nextMatched);
        setSelected([]);

        if (nextMatched.size === pairCount) {
          clearInterval(timerRef.current);
          const finalMs = Math.round(performance.now() - startTimeRef.current);
          setElapsedMs(finalMs);
          setFinished(true);
          recordStudyActivity();
          db.gameScores.add({
            profileId: activeProfileId,
            game: 'match',
            levelKey: targetLevels.join(','),
            score: Math.max(100, Math.round(100000 / Math.max(1000, finalMs))),
            timeMs: finalMs,
            createdAt: Date.now(),
          });
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.65 } });
        }
      } else {
        setWrongIds(new Set([first.uid, second.uid]));
        setTimeout(() => {
          setWrongIds(new Set());
          setSelected([]);
        }, 420);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#C2410C]">
            Nối Từ Siêu Tốc
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Timer className="w-4 h-4 text-[#0F766E]" />
            <span className="text-xl font-bold tabular-nums text-[#1E293B]">
              {(elapsedMs / 1000).toFixed(1)}s
            </span>
            <span className="text-xs text-slate-400">
              • {matchedPairIds.size}/{pairCount} cặp
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-[#FAF9F6] p-1 rounded-xl border border-slate-200/80 text-xs">
            {[6, 8].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPairCount(n)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
                  pairCount === n ? 'bg-[#0F766E] text-white' : 'text-slate-600'
                }`}
              >
                {n * 2} thẻ
              </button>
            ))}
          </div>

          <div className="inline-flex bg-[#FAF9F6] p-1 rounded-xl border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => setLeftType('hanzi')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
                leftType === 'hanzi' ? 'bg-[#0F766E] text-white' : 'text-slate-600'
              }`}
            >
              Chữ Hán
            </button>
            <button
              type="button"
              onClick={() => setLeftType('pinyin')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
                leftType === 'pinyin' ? 'bg-[#0F766E] text-white' : 'text-slate-600'
              }`}
            >
              Pinyin
            </button>
          </div>

          <button
            type="button"
            onClick={startRound}
            className="btn-tactile inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Chơi mới</span>
          </button>
        </div>
      </div>

      {/* Finished Banner */}
      {finished ? (
        <div className="bg-white rounded-2xl border border-[#0F766E]/30 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F0FDFA] text-[#0F766E] mx-auto flex items-center justify-center">
            <Trophy className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#1E293B]">
            Xuất sắc! Hoàn thành trong {(elapsedMs / 1000).toFixed(1)} giây
          </h2>
          <p className="text-sm text-slate-500">
            Kỷ lục đã được lưu vào hồ sơ cá nhân. Thử thách tiếp với lượt thẻ mới nhé!
          </p>
          <button
            type="button"
            onClick={startRound}
            className="btn-tactile inline-flex items-center gap-2 min-h-[46px] px-6 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Chơi ván tiếp theo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {cards.map((card) => {
            const isMatched = matchedPairIds.has(card.pairId);
            const isSelected = selected.some((c) => c.uid === card.uid);
            const isWrong = wrongIds.has(card.uid);

            return (
              <button
                key={card.uid}
                type="button"
                disabled={isMatched}
                onClick={() => handleCardClick(card)}
                className={`btn-tactile min-h-[86px] sm:min-h-[96px] p-3 rounded-2xl border text-center flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isMatched
                    ? 'opacity-0 scale-90 pointer-events-none border-transparent'
                    : isWrong
                    ? 'bg-red-50 border-red-400 text-red-700'
                    : isSelected
                    ? 'bg-[#F0FDFA] border-[#0F766E] text-[#0F766E] ring-2 ring-[#0F766E]/20'
                    : 'bg-white border-slate-200/85 hover:border-slate-300 text-[#1E293B]'
                }`}
              >
                <span
                  className={
                    card.side === 'zh' && leftType === 'hanzi'
                      ? 'font-hanzi-serif text-xl sm:text-2xl font-semibold'
                      : 'text-xs sm:text-sm font-semibold leading-snug line-clamp-3'
                  }
                >
                  {card.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

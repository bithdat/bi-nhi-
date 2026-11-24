import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import confetti from 'canvas-confetti';
import {
  RotateCw,
  Volume2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Keyboard,
  Layers,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { db, reviewKey } from '../db/database';
import { useApp } from '../context/AppContext';
import { computeSM2, formatIntervalLabel } from '../utils/sm2';
import { speakChinese } from '../utils/speech';
import { SpeakButton } from '../components/common/SpeakButton';
import { CustomFlashcardsManager } from '../components/flashcards/CustomFlashcardsManager';

const SESSION_LIMIT = 20;

export function Flashcards() {
  const { activeProfileId, activeProfile, targetLevels, speechRate, recordStudyActivity } = useApp();

  // Top-level source switch: 'hsk' (official HSK 3.0) | 'custom' (personal self-made cards)
  const [source, setSource] = useState('hsk');
  const [customStudyMeta, setCustomStudyMeta] = useState(null); // { title, cards } when actively studying custom cards

  const [mode, setMode] = useState('smart'); // smart (due + new) | due | new
  const [deck, setDeck] = useState([]);
  const [reviewMap, setReviewMap] = useState(new Map());
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showPinyinFront, setShowPinyinFront] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sessionDone, setSessionDone] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const touchStartX = useRef(null);

  const customCardCount = useLiveQuery(
    () => db.customCards.where('profileId').equals(activeProfileId).count(),
    [activeProfileId],
    0
  );

  // Reset custom study session when switching between Bi and Nhi
  useEffect(() => {
    setCustomStudyMeta(null);
  }, [activeProfileId]);

  const loadHskDeck = useCallback(async () => {
    setLoading(true);
    setSessionDone(false);
    setIndex(0);
    setFlipped(false);
    setReviewedCount(0);

    const [words, reviews] = await Promise.all([
      db.vocab.where('level').anyOf(targetLevels).toArray(),
      db.reviews.where('profileId').equals(activeProfileId).toArray(),
    ]);

    const rMap = new Map(reviews.map((r) => [r.vocabId, r]));
    setReviewMap(rMap);

    const now = Date.now();
    const dueWords = [];
    const newWords = [];
    const otherWords = [];

    for (const w of words) {
      const r = rMap.get(w.id);
      if (!r) {
        newWords.push(w);
      } else if (r.nextReviewDate <= now) {
        dueWords.push(w);
      } else {
        otherWords.push(w);
      }
    }

    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

    let chosen = [];
    if (mode === 'due') {
      chosen = shuffle(dueWords).slice(0, SESSION_LIMIT);
    } else if (mode === 'new') {
      chosen = shuffle(newWords).slice(0, SESSION_LIMIT);
    } else {
      chosen = [...shuffle(dueWords), ...shuffle(newWords)].slice(0, SESSION_LIMIT);
      if (chosen.length === 0) {
        chosen = shuffle(otherWords).slice(0, SESSION_LIMIT);
      }
    }

    setDeck(chosen);
    setLoading(false);
  }, [activeProfileId, targetLevels.join(','), mode]);

  const startCustomStudy = useCallback(
    async (cardsList, title) => {
      setLoading(true);
      setSessionDone(false);
      setIndex(0);
      setFlipped(false);
      setReviewedCount(0);

      const reviews = await db.reviews.where('profileId').equals(activeProfileId).toArray();
      const rMap = new Map(reviews.map((r) => [r.vocabId, r]));
      setReviewMap(rMap);

      const now = Date.now();
      // Prioritize due & new cards first, then remaining cards
      const dueOrNew = cardsList.filter((c) => {
        const r = rMap.get(c.id);
        return !r || r.nextReviewDate <= now;
      });
      const rest = cardsList.filter((c) => !dueOrNew.some((d) => d.id === c.id));
      const ordered = [
        ...[...dueOrNew].sort(() => Math.random() - 0.5),
        ...[...rest].sort(() => Math.random() - 0.5),
      ];

      setCustomStudyMeta({ title, cards: cardsList });
      setDeck(ordered);
      setLoading(false);
    },
    [activeProfileId]
  );

  useEffect(() => {
    if (source === 'hsk') {
      loadHskDeck();
    }
  }, [source, loadHskDeck]);

  const isStudying = source === 'hsk' || Boolean(customStudyMeta);
  const currentCard = isStudying ? deck[index] || null : null;
  const currentReview = currentCard ? reviewMap.get(currentCard.id) : null;

  // Auto-speak on card appearance
  useEffect(() => {
    if (isStudying && autoSpeak && currentCard && !sessionDone) {
      speakChinese(currentCard.hanzi, speechRate);
    }
  }, [isStudying, currentCard?.id, index, autoSpeak, sessionDone, speechRate]);

  const handleRate = useCallback(
    async (rating) => {
      if (!currentCard) return;
      const nextState = computeSM2(currentReview, rating);
      const record = {
        key: reviewKey(activeProfileId, currentCard.id),
        profileId: activeProfileId,
        vocabId: currentCard.id,
        level: source === 'custom' ? 'CUSTOM' : currentCard.level,
        ...nextState,
      };

      await db.reviews.put(record);
      recordStudyActivity();

      setReviewMap((prev) => {
        const next = new Map(prev);
        next.set(currentCard.id, record);
        return next;
      });

      setReviewedCount((c) => c + 1);
      setFlipped(false);

      if (rating === 'forgot') {
        setDeck((prev) => {
          const copy = [...prev];
          const insertAt = Math.min(copy.length, index + 3);
          copy.splice(insertAt, 0, currentCard);
          return copy;
        });
        setIndex((i) => i + 1);
        return;
      }

      if (index + 1 >= deck.length) {
        setSessionDone(true);
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.65 } });
      } else {
        setIndex((i) => i + 1);
      }
    },
    [currentCard, currentReview, activeProfileId, source, index, deck.length, recordStudyActivity]
  );

  // Keyboard shortcuts: Space flip, S speak, ArrowLeft/Right navigate, 1/2/3 rate
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (!isStudying || sessionDone || !currentCard) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        speakChinese(currentCard.hanzi, speechRate);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFlipped(false);
        setIndex((i) => Math.min(deck.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFlipped(false);
        setIndex((i) => Math.max(0, i - 1));
      } else if (flipped && e.key === '1') {
        handleRate('forgot');
      } else if (flipped && e.key === '2') {
        handleRate('vague');
      } else if (flipped && e.key === '3') {
        handleRate('known');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isStudying, currentCard, flipped, sessionDone, deck.length, speechRate, handleRate]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 55) {
      setFlipped(false);
      if (dx < 0) setIndex((i) => Math.min(deck.length - 1, i + 1));
      else setIndex((i) => Math.max(0, i - 1));
    }
  };

  const previewKnownDays = computeSM2(currentReview, 'known').interval;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header + Primary Source Switcher (HSK 3.0 vs Personal Custom Cards) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
            Lặp lại ngắt quãng SM-2
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B] mt-1">
            Flashcard Thông minh
          </h1>
        </div>

        <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          <button
            id="flashcard-source-hsk"
            type="button"
            onClick={() => {
              setSource('hsk');
              setCustomStudyMeta(null);
            }}
            className={`btn-tactile inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-lg text-xs font-semibold cursor-pointer ${
              source === 'hsk' ? 'bg-[#0F766E] text-white' : 'text-slate-600 hover:text-[#1E293B]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Kho HSK 3.0</span>
          </button>

          <button
            id="flashcard-source-custom"
            type="button"
            onClick={() => {
              setSource('custom');
              setCustomStudyMeta(null);
            }}
            className={`btn-tactile inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-lg text-xs font-semibold cursor-pointer ${
              source === 'custom' ? 'bg-[#C2410C] text-white' : 'text-slate-600 hover:text-[#1E293B]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Thẻ tự tạo ({activeProfile.name})</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                source === 'custom'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#FFF7ED] text-[#C2410C]'
              }`}
            >
              {customCardCount}
            </span>
          </button>
        </div>
      </div>

      {/* Custom Flashcards Manager View */}
      {source === 'custom' && !customStudyMeta ? (
        <CustomFlashcardsManager onStartStudy={startCustomStudy} />
      ) : (
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Sub-bar: Either HSK mode switcher OR Back to Custom Manager */}
          {source === 'custom' && customStudyMeta ? (
            <div className="flex items-center justify-between gap-3">
              <button
                id="custom-study-back-btn"
                type="button"
                onClick={() => setCustomStudyMeta(null)}
                className="btn-tactile inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-[#0F766E] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại bộ thẻ tự tạo</span>
              </button>
              <span className="text-xs font-semibold text-[#C2410C] bg-[#FFF7ED] px-3 py-1.5 rounded-xl border border-[#C2410C]/20">
                {customStudyMeta.title}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80">
                {[
                  { id: 'smart', label: 'Thông minh' },
                  { id: 'due', label: 'Cần ôn' },
                  { id: 'new', label: 'Từ mới' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`px-3 min-h-[34px] rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      mode === m.id ? 'bg-[#0F766E] text-white' : 'text-slate-600 hover:text-[#1E293B]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">
                Mục tiêu: <strong className="text-[#1E293B]">{targetLevels.join(', ')}</strong>
              </span>
            </div>
          )}

          {/* Controls Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[#1E293B]">
              Thẻ {deck.length ? Math.min(index + 1, deck.length) : 0} / {deck.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPinyinFront((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 text-slate-600 hover:text-[#0F766E] cursor-pointer"
              >
                {showPinyinFront ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>Pinyin mặt trước</span>
              </button>
              <button
                type="button"
                onClick={() => setAutoSpeak((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                  autoSpeak
                    ? 'bg-[#F0FDFA] border-[#0F766E]/30 text-[#0F766E]'
                    : 'bg-white border-slate-200/80 text-slate-500'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Tự đọc</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
            <div
              className="h-full bg-[#0F766E] rounded-full transition-all duration-300"
              style={{
                width: `${deck.length ? ((index + (sessionDone ? 1 : 0)) / deck.length) * 100 : 0}%`,
              }}
            />
          </div>

          {/* Main 3D Card Area */}
          {loading ? (
            <div className="h-80 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-sm text-slate-400">
              Đang chuẩn bị bộ thẻ SM-2...
            </div>
          ) : sessionDone ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#F0FDFA] text-[#0F766E] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#1E293B]">
                Tuyệt vời! Đã hoàn thành phiên ôn tập
              </h2>
              <p className="text-sm text-slate-500">
                Bạn vừa hoàn tất <strong>{reviewedCount}</strong> lượt đánh giá SM-2. Lịch ôn tập đã được cập nhật tự động.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    source === 'custom' && customStudyMeta
                      ? startCustomStudy(customStudyMeta.cards, customStudyMeta.title)
                      : loadHskDeck()
                  }
                  className="btn-tactile inline-flex items-center gap-2 min-h-[46px] px-6 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{source === 'custom' ? 'Ôn lại bộ thẻ này' : 'Học tiếp bộ 20 thẻ mới'}</span>
                </button>
                {source === 'custom' && (
                  <button
                    type="button"
                    onClick={() => setCustomStudyMeta(null)}
                    className="btn-tactile min-h-[46px] px-5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 cursor-pointer"
                  >
                    Quản lý thẻ tự tạo
                  </button>
                )}
              </div>
            </div>
          ) : !currentCard ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-3">
              <p className="text-base font-semibold text-[#1E293B]">
                Không có thẻ nào trong bộ lọc hiện tại!
              </p>
              <p className="text-sm text-slate-500">
                Chuyển sang chế độ "Thông minh" hoặc "Từ mới" để tiếp tục học.
              </p>
              <button
                type="button"
                onClick={() => setMode('smart')}
                className="btn-tactile min-h-[42px] px-5 rounded-xl bg-[#0F766E] text-white text-sm font-semibold cursor-pointer"
              >
                Chuyển sang chế độ Thông minh
              </button>
            </div>
          ) : (
            <>
              <div
                id="flashcard-3d-stage"
                className="perspective-1200 w-full cursor-pointer select-none"
                onClick={() => setFlipped((f) => !f)}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  className={`preserve-3d relative w-full min-h-[340px] sm:min-h-[370px] ${
                    flipped ? 'rotate-y-180' : ''
                  }`}
                >
                  {/* Front Face */}
                  <div className="backface-hidden absolute inset-0 bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                          source === 'custom'
                            ? 'bg-[#FFF7ED] border-[#C2410C]/20 text-[#C2410C]'
                            : 'bg-[#FAF9F6] border-slate-200/80 text-slate-600'
                        }`}
                      >
                        {currentCard.level || 'Thẻ tự tạo'}
                      </span>
                      <SpeakButton text={currentCard.hanzi} label="Nghe (S)" size="sm" />
                    </div>

                    <div className="text-center my-auto py-6">
                      <div className="font-hanzi-serif text-5xl sm:text-6xl font-semibold text-[#1E293B] tracking-wide">
                        {currentCard.hanzi}
                      </div>
                      {showPinyinFront && currentCard.pinyin && (
                        <p className="mt-3 text-lg font-medium text-[#0F766E]">
                          {currentCard.pinyin}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Chạm vào thẻ hoặc nhấn Space để xem nghĩa</span>
                    </div>
                  </div>

                  {/* Back Face */}
                  <div className="backface-hidden rotate-y-180 absolute inset-0 bg-white rounded-2xl border border-[#0F766E]/35 p-6 sm:p-8 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#F0FDFA] border border-[#0F766E]/20 text-[#0F766E]">
                        {currentCard.level || 'Thẻ tự tạo'} • Đáp án
                      </span>
                      <SpeakButton text={currentCard.hanzi} label="Đọc từ" size="sm" />
                    </div>

                    <div className="text-center my-auto space-y-2 py-2">
                      <div className="font-hanzi-serif text-4xl font-semibold text-[#1E293B]">
                        {currentCard.hanzi}
                      </div>
                      {currentCard.pinyin && (
                        <p className="text-lg font-semibold text-[#0F766E]">{currentCard.pinyin}</p>
                      )}
                      <p className="text-xl font-bold text-[#1E293B] pt-1">{currentCard.meaning}</p>

                      {currentCard.example_zh && (
                        <div
                          className="mt-4 p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/70 text-left flex items-start justify-between gap-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-0.5 text-xs sm:text-sm">
                            <p className="font-hanzi text-[#1E293B] font-medium">
                              {currentCard.example_zh}
                            </p>
                            {currentCard.example_vi && (
                              <p className="text-slate-500">{currentCard.example_vi}</p>
                            )}
                          </div>
                          <SpeakButton text={currentCard.example_zh} size="sm" />
                        </div>
                      )}
                    </div>

                    <p className="text-center text-xs text-slate-400">
                      Đánh giá mức độ ghi nhớ của bạn bên dưới
                    </p>
                  </div>
                </div>
              </div>

              {/* SM-2 Rating Controls */}
              <div className="space-y-3">
                {flipped ? (
                  <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                    <button
                      id="sm2-rate-forgot"
                      type="button"
                      onClick={() => handleRate('forgot')}
                      className="btn-tactile min-h-[56px] px-3 py-2.5 rounded-2xl bg-[#FFF7ED] hover:bg-orange-100/80 border border-[#C2410C]/30 text-[#C2410C] flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-sm font-bold">Quên (1)</span>
                      <span className="text-[11px] opacity-80">Ôn ngay</span>
                    </button>
                    <button
                      id="sm2-rate-vague"
                      type="button"
                      onClick={() => handleRate('vague')}
                      className="btn-tactile min-h-[56px] px-3 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100/70 border border-amber-300/70 text-amber-800 flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-sm font-bold">Mang máng (2)</span>
                      <span className="text-[11px] opacity-80">1 ngày</span>
                    </button>
                    <button
                      id="sm2-rate-known"
                      type="button"
                      onClick={() => handleRate('known')}
                      className="btn-tactile min-h-[56px] px-3 py-2.5 rounded-2xl bg-[#0F766E] hover:bg-[#115E59] border border-[#0F766E] text-white flex flex-col items-center justify-center cursor-pointer"
                    >
                      <span className="text-sm font-bold">Đã thuộc (3)</span>
                      <span className="text-[11px] opacity-85">
                        {formatIntervalLabel(previewKnownDays)}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => setIndex((i) => Math.max(0, i - 1))}
                      className="btn-tactile min-h-[48px] px-4 rounded-xl bg-white border border-slate-200/90 text-slate-600 disabled:opacity-40 inline-flex items-center gap-1 text-sm font-medium cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Trước</span>
                    </button>

                    <button
                      id="flashcard-flip-btn"
                      type="button"
                      onClick={() => setFlipped(true)}
                      className="btn-tactile flex-1 min-h-[48px] rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold cursor-pointer"
                    >
                      Lật thẻ xem đáp án (Space)
                    </button>

                    <button
                      type="button"
                      disabled={index >= deck.length - 1}
                      onClick={() => setIndex((i) => Math.min(deck.length - 1, i + 1))}
                      className="btn-tactile min-h-[48px] px-4 rounded-xl bg-white border border-slate-200/90 text-slate-600 disabled:opacity-40 inline-flex items-center gap-1 text-sm font-medium cursor-pointer"
                    >
                      <span>Tiếp</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="hidden sm:flex items-center justify-center gap-4 text-[11px] text-slate-400 pt-1">
                  <span className="inline-flex items-center gap-1">
                    <Keyboard className="w-3.5 h-3.5" /> Phím tắt:
                  </span>
                  <span>Space: Lật thẻ</span>
                  <span>S: Phát âm</span>
                  <span>←/→: Chuyển từ</span>
                  <span>1 / 2 / 3: Đánh giá</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Flame,
  BookCheck,
  Clock,
  Sparkles,
  Layers,
  Gamepad2,
  ClipboardCheck,
  ArrowRight,
  Trophy,
  BookOpen,
} from 'lucide-react';
import { db } from '../db/database';
import { useApp } from '../context/AppContext';
import { HSK_LEVELS } from '../constants/hsk';

export function Dashboard({ onNavigate }) {
  const { activeProfileId, activeProfile, targetLevels, streak, bestStreak } = useApp();

  const stats = useLiveQuery(async () => {
    const [allVocab, myReviews, myGames, myExams, myLogs] = await Promise.all([
      db.vocab.where('level').anyOf(targetLevels).toArray(),
      db.reviews.where('profileId').equals(activeProfileId).toArray(),
      db.gameScores.where('profileId').equals(activeProfileId).toArray(),
      db.examHistory.where('profileId').equals(activeProfileId).toArray(),
      db.translationLogs.where('profileId').equals(activeProfileId).toArray(),
    ]);

    const now = Date.now();
    const targetSet = new Set(targetLevels);
    const reviewMap = new Map();
    for (const r of myReviews) {
      if (targetSet.has(r.level)) reviewMap.set(r.vocabId, r);
    }

    const perLevel = targetLevels.map((lvl) => {
      const words = allVocab.filter((w) => w.level === lvl);
      let learned = 0;
      let mastered = 0;
      let dueToday = 0;
      for (const w of words) {
        const rev = reviewMap.get(w.id);
        if (rev) {
          learned += 1;
          if (rev.status === 'mastered') mastered += 1;
          if (rev.nextReviewDate <= now) dueToday += 1;
        }
      }
      return {
        level: lvl,
        total: words.length,
        learned,
        mastered,
        dueToday,
      };
    });

    const totals = perLevel.reduce(
      (acc, cur) => ({
        total: acc.total + cur.total,
        learned: acc.learned + cur.learned,
        mastered: acc.mastered + cur.mastered,
        dueToday: acc.dueToday + cur.dueToday,
      }),
      { total: 0, learned: 0, mastered: 0, dueToday: 0 }
    );

    const bestRacer = myGames
      .filter((g) => g.game === 'racer' && g.timeMs > 0)
      .sort((a, b) => a.timeMs - b.timeMs)[0];

    const bestMatch = myGames
      .filter((g) => g.game === 'match' && g.timeMs > 0)
      .sort((a, b) => a.timeMs - b.timeMs)[0];

    const bestShooter = myGames
      .filter((g) => g.game === 'shooter')
      .sort((a, b) => b.score - a.score)[0];

    const bestExam = myExams.sort((a, b) => b.totalScore - a.totalScore)[0];

    const avgAiScore =
      myLogs.length > 0
        ? (myLogs.reduce((s, l) => s + (Number(l.score) || 0), 0) / myLogs.length).toFixed(1)
        : null;

    return {
      perLevel,
      totals,
      bestRacer,
      bestMatch,
      bestShooter,
      bestExam,
      avgAiScore,
      totalExams: myExams.length,
      totalAiLogs: myLogs.length,
    };
  }, [activeProfileId, targetLevels.join(',')]);

  const totals = stats?.totals || { total: 0, learned: 0, mastered: 0, dueToday: 0 };

  return (
    <div className="space-y-7">
      {/* Warm Editorial Greeting Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
            Bi &amp; Nhi HSK • Bảng điều khiển
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B] mt-1">
            Chào {activeProfile.name}, hôm nay học gì nào?
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Đang tập trung vào <strong className="text-[#1E293B]">{targetLevels.join(', ')}</strong> ({totals.total.toLocaleString('vi-VN')} từ trong mục tiêu).
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('flashcards')}
            className="btn-tactile inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Ôn Flashcard</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('arcade')}
            className="btn-tactile inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-white border border-slate-200/90 hover:border-[#C2410C]/40 hover:text-[#C2410C] text-[#1E293B] text-sm font-semibold cursor-pointer"
          >
            <Gamepad2 className="w-4 h-4 text-[#C2410C]" />
            <span>Chơi game từ vựng</span>
          </button>
        </div>
      </section>

      {/* 4 Key Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Từ đã học</span>
            <BookOpen className="w-4 h-4 text-[#0F766E]" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold text-[#1E293B]">
              {totals.learned.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs text-slate-400">/ {totals.total.toLocaleString('vi-VN')}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Đã chạm qua ít nhất 1 lần</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Từ đã thuộc</span>
            <BookCheck className="w-4 h-4 text-[#0F766E]" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold text-[#0F766E]">
              {totals.mastered.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs text-slate-400">
              ({totals.total ? Math.round((totals.mastered / totals.total) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Ghi nhớ bền vững SM-2</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Cần ôn hôm nay</span>
            <Clock className="w-4 h-4 text-[#C2410C]" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold text-[#C2410C]">
              {totals.dueToday.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs text-slate-400">từ</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('flashcards')}
            className="mt-1 text-[11px] font-semibold text-[#0F766E] hover:underline cursor-pointer"
          >
            {totals.dueToday > 0 ? 'Vào ôn ngay →' : 'Học thêm từ mới →'}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Chuỗi ngày học</span>
            <Flame className="w-4 h-4 text-[#C2410C]" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-bold text-[#1E293B]">{streak}</span>
            <span className="text-xs text-slate-400">ngày</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Kỷ lục cá nhân: {bestStreak} ngày
          </p>
        </div>
      </section>

      {/* Per-Level Progress */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1E293B]">
              Tiến độ theo từng cấp độ HSK 3.0
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi riêng biệt cho hồ sơ của {activeProfile.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('vocabulary')}
            className="text-xs font-semibold text-[#0F766E] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Mở Kho từ vựng</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-4">
          {(stats?.perLevel || []).map((row) => {
            const meta = HSK_LEVELS.find((l) => l.id === row.level);
            const masteredPct = row.total ? Math.round((row.mastered / row.total) * 100) : 0;
            const learnedPct = row.total ? Math.round((row.learned / row.total) * 100) : 0;

            return (
              <div
                key={row.level}
                className="p-4 rounded-xl bg-[#FAF9F6] border border-slate-200/70 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="sm:w-44 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1E293B]">{meta?.label || row.level}</span>
                    <span className="text-[11px] text-slate-500">{meta?.title}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {row.total.toLocaleString('vi-VN')} từ trong kho
                  </p>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-600">
                      Thuộc <strong className="text-[#0F766E]">{row.mastered}</strong> • Đã học{' '}
                      <strong>{row.learned}</strong> • Cần ôn{' '}
                      <strong className="text-[#C2410C]">{row.dueToday}</strong>
                    </span>
                    <span className="font-semibold text-[#1E293B]">{masteredPct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200/80 overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-300/80 rounded-full transition-all duration-500"
                      style={{ width: `${learnedPct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-[#0F766E] rounded-full transition-all duration-500"
                      style={{ width: `${masteredPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Personal High Scores & Quick Modules */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Arcade High Scores */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#C2410C]" />
                <span>Kỷ lục Trò chơi</span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('arcade')}
                className="text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
              >
                Chơi ngay
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Đua xe vượt cổng</span>
                <span className="font-semibold text-[#1E293B]">
                  {stats?.bestRacer ? `${(stats.bestRacer.timeMs / 1000).toFixed(1)}s` : 'Chưa có kỷ lục'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Nối từ siêu tốc</span>
                <span className="font-semibold text-[#1E293B]">
                  {stats?.bestMatch ? `${(stats.bestMatch.timeMs / 1000).toFixed(1)}s` : 'Chưa có kỷ lục'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-600">Máy bay bắn chữ</span>
                <span className="font-semibold text-[#1E293B]">
                  {stats?.bestShooter ? `${stats.bestShooter.score} điểm` : 'Chưa có kỷ lục'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Exam Summary */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#0F766E]" />
                <span>Phòng thi HSK 3.0</span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('exam')}
                className="text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
              >
                Vào phòng thi
              </button>
            </div>
            {stats?.bestExam ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Thành tích cao nhất ({stats.bestExam.level}):</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#0F766E]">{stats.bestExam.totalScore}</span>
                  <span className="text-xs text-slate-400">/ {stats.bestExam.maxScore || 200} điểm</span>
                </div>
                <p className="text-xs text-slate-500">
                  Đã hoàn thành {stats.totalExams} lượt thi thử &amp; luyện tập.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Chưa có bài thi nào. Thử sức với Practice Quiz hoặc đề mô phỏng khảo thí HSK iBT chuẩn có đồng hồ đếm ngược ngay nhé!
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('exam')}
            className="btn-tactile mt-4 w-full min-h-[42px] rounded-xl bg-[#FAF9F6] hover:bg-[#F0FDFA] border border-slate-200/80 hover:border-[#0F766E]/30 text-xs font-semibold text-[#1E293B] cursor-pointer"
          >
            Bắt đầu thi thử →
          </button>
        </div>

        {/* AI Studio Summary */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#C2410C]" />
                <span>Trợ lý AI Luyện Dịch</span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('ai')}
                className="text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
              >
                Mở AI Studio
              </button>
            </div>
            {stats?.avgAiScore ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Điểm trung bình bài dịch &amp; đặt câu:</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-[#C2410C]">{stats.avgAiScore}</span>
                  <span className="text-xs text-slate-400">/ 10 điểm</span>
                </div>
                <p className="text-xs text-slate-500">
                  Tổng {stats.totalAiLogs} nhật ký luyện tập đã lưu.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                Luyện dịch song ngữ Trung ↔ Việt, chấm ngữ pháp đặt câu và hội thoại giao tiếp bản xứ theo đúng cấp độ {targetLevels.join(', ')}.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ai')}
            className="btn-tactile mt-4 w-full min-h-[42px] rounded-xl bg-[#FAF9F6] hover:bg-[#FFF7ED] border border-slate-200/80 hover:border-[#C2410C]/30 text-xs font-semibold text-[#1E293B] cursor-pointer"
          >
            Luyện cùng Gemini AI →
          </button>
        </div>
      </section>
    </div>
  );
}

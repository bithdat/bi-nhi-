import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Car, Grid2X2, Rocket, Trophy, ArrowLeft, Play } from 'lucide-react';
import { db } from '../db/database';
import { useApp } from '../context/AppContext';
import { VocabLaneRacer } from './games/VocabLaneRacer';
import { WordMatch } from './games/WordMatch';
import { SpaceTypingShooter } from './games/SpaceTypingShooter';

export function ArcadeHub() {
  const { activeProfileId, activeProfile, targetLevels } = useApp();
  const [activeGame, setActiveGame] = useState(null); // null | 'racer' | 'match' | 'shooter'

  const records = useLiveQuery(async () => {
    const scores = await db.gameScores.where('profileId').equals(activeProfileId).toArray();
    const bestRacer = scores
      .filter((s) => s.game === 'racer' && s.timeMs > 0)
      .sort((a, b) => a.timeMs - b.timeMs)[0];
    const bestMatch = scores
      .filter((s) => s.game === 'match' && s.timeMs > 0)
      .sort((a, b) => a.timeMs - b.timeMs)[0];
    const bestShooter = scores
      .filter((s) => s.game === 'shooter')
      .sort((a, b) => b.score - a.score)[0];
    return { bestRacer, bestMatch, bestShooter };
  }, [activeProfileId]);

  if (activeGame) {
    return (
      <div className="space-y-4">
        <button
          id="arcade-back-btn"
          type="button"
          onClick={() => setActiveGame(null)}
          className="btn-tactile inline-flex items-center gap-1.5 min-h-[42px] px-3.5 rounded-xl bg-white border border-slate-200/90 text-xs sm:text-sm font-semibold text-slate-700 hover:text-[#0F766E] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Khu vui chơi</span>
        </button>

        {activeGame === 'racer' && <VocabLaneRacer />}
        {activeGame === 'match' && <WordMatch />}
        {activeGame === 'shooter' && <SpaceTypingShooter />}
      </div>
    );
  }

  const games = [
    {
      id: 'racer',
      title: 'Đua Xe Vượt Cổng Từ Vựng',
      subtitle: 'Vocab Lane Racer • 3 Làn Đường',
      desc: 'Lái xe vượt qua 10 cổng đáp án tốc độ cao. Hỗ trợ phím ←/→, A/D hoặc chạm/vuốt trực tiếp trên đường đua.',
      icon: Car,
      accent: 'text-[#0F766E] bg-[#F0FDFA] border-[#0F766E]/20',
      recordLabel: 'Kỷ lục về đích',
      recordValue: records?.bestRacer ? `${(records.bestRacer.timeMs / 1000).toFixed(1)}s` : 'Chưa có',
    },
    {
      id: 'match',
      title: 'Nối Từ Siêu Tốc',
      subtitle: 'Word Match • Lưới 12–16 Thẻ',
      desc: 'Ghép nhanh các cặp Chữ Hán / Pinyin và Nghĩa tiếng Việt trong thời gian ngắn nhất để phá kỷ lục.',
      icon: Grid2X2,
      accent: 'text-[#C2410C] bg-[#FFF7ED] border-[#C2410C]/20',
      recordLabel: 'Thời gian nhanh nhất',
      recordValue: records?.bestMatch ? `${(records.bestMatch.timeMs / 1000).toFixed(1)}s` : 'Chưa có',
    },
    {
      id: 'shooter',
      title: 'Máy Bay Bắn Chữ',
      subtitle: 'Space Typing Shooter • Gõ Pinyin',
      desc: 'Gõ nhanh Pinyin không dấu rồi nhấn Space/Enter để bắn tia laser tiêu diệt thiên thạch Chữ Hán trước khi chạm đáy.',
      icon: Rocket,
      accent: 'text-sky-700 bg-sky-50 border-sky-200/80',
      recordLabel: 'Điểm cao nhất',
      recordValue: records?.bestShooter ? `${records.bestShooter.score} điểm` : 'Chưa có',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#C2410C]">
          Khu vui chơi Từ vựng • {activeProfile.name}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B] mt-1">
          Học HSK qua Trò chơi Phản xạ
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Toàn bộ câu hỏi được sinh trực tiếp từ kho từ vựng mục tiêu{' '}
          <strong className="text-[#1E293B]">{targetLevels.join(', ')}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {games.map((g) => {
          const Icon = g.icon;
          return (
            <div
              key={g.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${g.accent}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400 flex items-center justify-end gap-1">
                      <Trophy className="w-3 h-3 text-[#C2410C]" />
                      {g.recordLabel}
                    </p>
                    <p className="text-sm font-bold text-[#1E293B] mt-0.5">{g.recordValue}</p>
                  </div>
                </div>

                <h2 className="text-lg font-bold text-[#1E293B] mt-4">{g.title}</h2>
                <p className="text-xs font-medium text-[#0F766E] mt-0.5">{g.subtitle}</p>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-3">{g.desc}</p>
              </div>

              <button
                id={`arcade-play-${g.id}`}
                type="button"
                onClick={() => setActiveGame(g.id)}
                className="btn-tactile mt-5 w-full min-h-[46px] rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Chơi ngay</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

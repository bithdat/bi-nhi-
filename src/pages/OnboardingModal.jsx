import React, { useState } from 'react';
import { Check, ArrowRight, BookOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HSK_LEVELS, PROFILES } from '../constants/hsk';
import { BrandLogo } from '../components/common/BrandLogo';

export function OnboardingModal() {
  const { activeProfileId, completeOnboarding, profileStates } = useApp();
  const [selectedProfile, setSelectedProfile] = useState(activeProfileId || 'bi');
  const [selectedLevels, setSelectedLevels] = useState(() => {
    const saved = profileStates[activeProfileId]?.targetLevels;
    return saved && saved.length > 0 ? saved : ['HSK1', 'HSK2'];
  });

  const handleProfilePick = (pid) => {
    setSelectedProfile(pid);
    const saved = profileStates[pid]?.targetLevels;
    if (saved && saved.length > 0) setSelectedLevels(saved);
  };

  const toggleLevel = (id) => {
    const order = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
    setSelectedLevels((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    });
  };

  const totalSelectedWords = HSK_LEVELS.filter((l) => selectedLevels.includes(l.id)).reduce(
    (sum, l) => sum + l.officialCount,
    0
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-between px-4 py-8 sm:py-12">
      <div className="max-w-3xl w-full mx-auto animate-page-in">
        {/* Top Brand Identity */}
        <div className="flex flex-col items-center text-center mb-8 sm:mb-10">
          <BrandLogo size="lg" showSubtitle />
          <h1 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B]">
            Chọn cấp độ HSK bạn muốn học
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
            Chọn hồ sơ của bạn và một hoặc nhiều cấp độ chuẩn <strong>HSK 3.0</strong>. Toàn bộ kho từ vựng, Flashcard, trò chơi, đề thi và trợ lý AI sẽ tự động cá nhân hóa theo mục tiêu này.
          </p>
        </div>

        {/* Step 1: Choose Profile (Bi or Nhi) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Bước 1 • Hồ sơ riêng biệt
              </p>
              <p className="text-sm font-semibold text-[#1E293B] mt-0.5">
                Hôm nay ai đang học?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:w-64">
              {(['bi', 'nhi']).map((pid) => {
                const p = PROFILES[pid];
                const active = selectedProfile === pid;
                return (
                  <button
                    key={pid}
                    id={`onboarding-profile-${pid}`}
                    type="button"
                    onClick={() => handleProfilePick(pid)}
                    className={`btn-tactile flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-xl border text-sm font-semibold cursor-pointer ${
                      active
                        ? pid === 'bi'
                          ? 'bg-[#0F766E] border-[#0F766E] text-white'
                          : 'bg-[#C2410C] border-[#C2410C] text-white'
                        : 'bg-[#FAF9F6] border-slate-200/90 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-hanzi-serif text-base opacity-90">{p.hanziMark}</span>
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step 2: Select HSK Levels */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Bước 2 • Cấp độ mục tiêu (có thể chọn nhiều)
            </p>
            <span className="text-xs font-medium text-slate-500">
              Đã chọn <strong className="text-[#0F766E]">{selectedLevels.length}</strong> cấp độ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {HSK_LEVELS.map((lvl) => {
              const selected = selectedLevels.includes(lvl.id);
              return (
                <button
                  key={lvl.id}
                  id={`onboarding-level-${lvl.id}`}
                  type="button"
                  onClick={() => toggleLevel(lvl.id)}
                  className={`btn-tactile group text-left p-4 rounded-2xl border cursor-pointer flex flex-col justify-between min-h-[132px] ${
                    selected
                      ? 'bg-[#F0FDFA] border-[#0F766E]/60'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-[#1E293B]">{lvl.label}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200/80 text-slate-600">
                          {lvl.officialCount.toLocaleString('vi-VN')} từ
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#0F766E] mt-1">{lvl.title}</p>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                        selected
                          ? 'bg-[#0F766E] border-[#0F766E] text-white'
                          : 'bg-[#FAF9F6] border-slate-300 text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mt-3">{lvl.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] border border-[#0F766E]/15 flex items-center justify-center text-[#0F766E] shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-[#1E293B]">
                Lộ trình của {PROFILES[selectedProfile].name}: {selectedLevels.join(', ')}
              </p>
              <p className="text-xs text-slate-500">
                Khoảng {totalSelectedWords.toLocaleString('vi-VN')} từ vựng chuẩn HSK 3.0 — có thể đổi bất cứ lúc nào trên thanh tiêu đề.
              </p>
            </div>
          </div>

          <button
            id="onboarding-start-btn"
            type="button"
            onClick={() => completeOnboarding(selectedProfile, selectedLevels)}
            className="btn-tactile w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[48px] px-7 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold cursor-pointer shrink-0"
          >
            <span>Bắt đầu học</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-8">
        Bi &amp; Nhi HSK • Dữ liệu học tập lưu cục bộ riêng biệt cho Bi và Nhi ngay trên trình duyệt.
      </p>
    </div>
  );
}

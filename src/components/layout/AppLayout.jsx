import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Gamepad2,
  ClipboardCheck,
  Sparkles,
  Settings as SettingsIcon,
  ChevronDown,
  Check,
  Flame,
  Gauge,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HSK_LEVELS, PROFILES } from '../../constants/hsk';
import { BrandLogo } from '../common/BrandLogo';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', shortLabel: 'Chính', icon: LayoutDashboard },
  { id: 'vocabulary', label: 'Kho từ vựng', shortLabel: 'Từ vựng', icon: BookOpen },
  { id: 'flashcards', label: 'Flashcard SM-2', shortLabel: 'Thẻ nhớ', icon: Layers },
  { id: 'arcade', label: 'Khu vui chơi', shortLabel: 'Trò chơi', icon: Gamepad2 },
  { id: 'exam', label: 'Phòng thi HSK', shortLabel: 'Thi thử', icon: ClipboardCheck },
  { id: 'ai', label: 'Trợ lý AI', shortLabel: 'AI Studio', icon: Sparkles },
  { id: 'settings', label: 'Cài đặt', shortLabel: 'Cài đặt', icon: SettingsIcon },
];

export function AppLayout({ activeTab, onNavigate, children }) {
  const {
    activeProfileId,
    activeProfile,
    targetLevels,
    toggleTargetLevel,
    switchProfile,
    streak,
    speechRate,
    setSpeechRate,
  } = useApp();

  const [levelPopoverOpen, setLevelPopoverOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setLevelPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const targetSummary = targetLevels
    .map((l) => l.replace('HSK', ''))
    .join(', ');

  return (
    <div className="min-h-screen flex bg-[#FAF9F6] text-[#1E293B]">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/80 z-30">
        <div className="px-5 pt-6 pb-5 border-b border-slate-100">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="text-left cursor-pointer focus:outline-none"
          >
            <BrandLogo size="md" showSubtitle />
          </button>
        </div>

        <nav className="flex-1 px-3.5 py-5 space-y-1 overflow-y-auto" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-desktop-${item.id}`}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`btn-tactile w-full flex items-center gap-3 px-3.5 min-h-[44px] rounded-xl text-sm font-medium cursor-pointer ${
                  active
                    ? 'bg-[#F0FDFA] text-[#0F766E] border border-[#0F766E]/20'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#1E293B] border border-transparent'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-[#0F766E]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Profile + Streak Summary */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-slate-200/70">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Flame className="w-4 h-4 text-[#C2410C]" />
              <span>Chuỗi của {activeProfile.name}</span>
            </div>
            <span className="text-sm font-bold text-[#1E293B]">{streak} ngày</span>
          </div>
          <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
            Bi &amp; Nhi HSK • Chuẩn HSK 3.0
          </p>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-20 bg-[#FAF9F6]/90 backdrop-blur-md border-b border-slate-200/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
            {/* Mobile Brand */}
            <div className="lg:hidden flex items-center min-w-0">
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="cursor-pointer focus:outline-none"
              >
                <BrandLogo size="sm" />
              </button>
            </div>

            {/* Desktop Current Section Hint */}
            <div className="hidden lg:flex items-center gap-2.5 text-sm text-slate-500">
              <span className="font-hanzi-serif text-base text-[#0F766E]">{activeProfile.hanziMark}</span>
              <span>
                Đang học cùng hồ sơ <strong className="text-[#1E293B]">{activeProfile.name}</strong>
              </span>
            </div>

            {/* Right Controls: Quick Level Switcher + Speech Speed + Bi/Nhi Switcher */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Quick HSK Target Level Switcher */}
              <div className="relative" ref={popoverRef}>
                <button
                  id="header-level-switcher"
                  type="button"
                  onClick={() => setLevelPopoverOpen((v) => !v)}
                  className="btn-tactile inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-[42px] px-3 rounded-xl bg-white border border-slate-200/90 hover:border-[#0F766E]/40 text-xs sm:text-sm font-medium text-[#1E293B] cursor-pointer"
                >
                  <span className="hidden sm:inline text-slate-500">Mục tiêu:</span>
                  <span className="font-semibold text-[#0F766E]">HSK {targetSummary}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      levelPopoverOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {levelPopoverOpen && (
                  <div className="animate-modal-in absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white border border-slate-200/90 shadow-lg shadow-slate-900/5 p-3.5 z-40">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-[#1E293B]">
                          Cấp độ mục tiêu ({activeProfile.name})
                        </p>
                        <p className="text-xs text-slate-500">
                          Bật/tắt để lọc nội dung toàn trang web
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {HSK_LEVELS.map((lvl) => {
                        const selected = targetLevels.includes(lvl.id);
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => toggleTargetLevel(lvl.id)}
                            className={`btn-tactile flex items-center justify-between px-3 py-2.5 rounded-xl border text-left cursor-pointer ${
                              selected
                                ? 'bg-[#F0FDFA] border-[#0F766E]/40 text-[#0F766E]'
                                : 'bg-[#FAF9F6] border-slate-200/80 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div>
                              <div className="text-sm font-semibold">{lvl.label}</div>
                              <div className="text-[11px] opacity-75">{lvl.officialCount} từ</div>
                            </div>
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                selected
                                  ? 'bg-[#0F766E] border-[#0F766E] text-white'
                                  : 'bg-white border-slate-300'
                              }`}
                            >
                              {selected && <Check className="w-3.5 h-3.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick TTS Rate Toggle */}
              <button
                id="header-speech-rate"
                type="button"
                onClick={() => setSpeechRate(speechRate === 1.0 ? 0.75 : 1.0)}
                title="Đổi tốc độ phát âm tiếng Trung"
                className="btn-tactile hidden sm:inline-flex items-center gap-1 min-h-[42px] px-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-[#0F766E]/40 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                <Gauge className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>{speechRate}x</span>
              </button>

              {/* Bi & Nhi Quick Profile Switcher */}
              <div
                className="inline-flex items-center p-1 rounded-xl bg-white border border-slate-200/90"
                role="group"
                aria-label="Chuyển hồ sơ Bi và Nhi"
              >
                {(['bi', 'nhi']).map((pid) => {
                  const p = PROFILES[pid];
                  const active = activeProfileId === pid;
                  return (
                    <button
                      key={pid}
                      id={`profile-switch-${pid}`}
                      type="button"
                      onClick={() => switchProfile(pid)}
                      className={`btn-tactile px-2.5 sm:px-3 min-h-[32px] rounded-lg text-xs font-semibold cursor-pointer ${
                        active
                          ? pid === 'bi'
                            ? 'bg-[#0F766E] text-white'
                            : 'bg-[#C2410C] text-white'
                          : 'text-slate-500 hover:text-[#1E293B]'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-12">
          <div key={`${activeTab}-${activeProfileId}`} className="animate-page-in">
            {children}
          </div>
        </main>

        {/* Subtle Editorial Footer */}
        <footer className="hidden lg:block border-t border-slate-200/70 bg-white/50 mt-auto">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-500">
            <span>
              <strong className="text-[#1E293B] font-semibold">Bi &amp; Nhi HSK</strong> — Không gian học &amp; luyện thi HSK 3.0 dành riêng cho hai người.
            </span>
            <span className="font-hanzi text-slate-400">好好学习，天天向上</span>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1.5 py-1.5"
        aria-label="Điều hướng di động"
      >
        <div className="grid grid-cols-7 gap-0.5 max-w-xl mx-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-mobile-${item.id}`}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`btn-tactile flex flex-col items-center justify-center min-h-[48px] rounded-xl text-[10px] font-medium cursor-pointer ${
                  active ? 'text-[#0F766E] bg-[#F0FDFA]' : 'text-slate-500'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] mb-0.5 ${active ? 'text-[#0F766E]' : 'text-slate-400'}`} />
                <span className="truncate max-w-full px-0.5">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Trash2,
  Volume2,
  Users,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { db } from '../db/database';
import { useApp } from '../context/AppContext';
import { PROFILES } from '../constants/hsk';
import { speakChinese } from '../utils/speech';

export function Settings() {
  const {
    activeProfileId,
    activeProfile,
    switchProfile,
    speechRate,
    setSpeechRate,
    personalApiKey,
    setPersonalApiKey,
    showToast,
  } = useApp();

  const [keyDraft, setKeyDraft] = useState(personalApiKey);
  const [showKey, setShowKey] = useState(false);

  const handleSaveKey = (e) => {
    e.preventDefault();
    setPersonalApiKey(keyDraft);
    showToast(
      keyDraft.trim()
        ? 'Đã lưu Personal Gemini API Key (ưu tiên sử dụng cho mọi tính năng AI).'
        : 'Đã xóa key cá nhân — hệ thống sẽ dùng key mặc định của máy chủ (/api/).'
    );
  };

  const handleResetProfileProgress = async () => {
    const ok = window.confirm(
      `Bạn có chắc muốn đặt lại toàn bộ tiến độ Flashcard, kỷ lục trò chơi, lịch sử thi và nhật ký AI của riêng ${activeProfile.name}? (Kho từ vựng và tiến độ của người còn lại vẫn giữ nguyên.)`
    );
    if (!ok) return;

    await Promise.all([
      db.reviews.where('profileId').equals(activeProfileId).delete(),
      db.gameScores.where('profileId').equals(activeProfileId).delete(),
      db.examHistory.where('profileId').equals(activeProfileId).delete(),
      db.translationLogs.where('profileId').equals(activeProfileId).delete(),
    ]);
    showToast(`Đã làm mới toàn bộ tiến độ học tập của ${activeProfile.name}.`, 'info');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
          Cài đặt &amp; Bảo mật
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B] mt-1">
          Tùy chỉnh Bi &amp; Nhi HSK
        </h1>
      </div>

      {/* Personal Gemini API Key */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] border border-[#0F766E]/20 text-[#0F766E] flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E293B]">
              Personal Gemini API Key (Tùy chọn)
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Nếu bạn nhập key cá nhân tại đây, ứng dụng sẽ <strong>ưu tiên sử dụng key của bạn</strong> và chỉ lưu cục bộ trong trình duyệt. Nếu để trống, ứng dụng tự động dùng khóa bảo mật mặc định trên máy chủ Vercel (<code className="px-1 py-0.5 bg-slate-100 rounded">/api/*</code>).
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveKey} className="space-y-3">
          <div className="relative">
            <input
              id="settings-gemini-key-input"
              type={showKey ? 'text' : 'password'}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="AIzaSy... (để trống nếu dùng key mặc định từ /api/)"
              className="w-full min-h-[46px] pl-4 pr-12 rounded-xl bg-[#FAF9F6] border border-slate-200/90 focus:border-[#0F766E] focus:bg-white focus:outline-none text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label="Hiện hoặc ẩn API Key"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg hover:bg-slate-200/60 flex items-center justify-center text-slate-500 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
              <span>
                Trạng thái:{' '}
                <strong className="text-[#1E293B]">
                  {personalApiKey ? 'Đang ưu tiên Personal Key' : 'Đang dùng Server /api/ mặc định'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {personalApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyDraft('');
                    setPersonalApiKey('');
                    showToast('Đã xóa Personal Gemini API Key.', 'info');
                  }}
                  className="btn-tactile min-h-[40px] px-3.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Xóa key
                </button>
              )}
              <button
                id="settings-save-key-btn"
                type="submit"
                className="btn-tactile inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Lưu cài đặt</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Audio / TTS Speed */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FAF9F6] border border-slate-200 text-[#0F766E] flex items-center justify-center shrink-0">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E293B]">Giọng đọc tiếng Trung (zh-CN)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Áp dụng cho Kho từ vựng, Flashcard, Trò chơi và Phòng thi Nghe.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[0.75, 1.0].map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => {
                setSpeechRate(rate);
                speakChinese('你好，欢迎来到Bi和Nhi的中文学习空间。', rate);
              }}
              className={`btn-tactile min-h-[42px] px-4 rounded-xl border text-xs font-semibold cursor-pointer ${
                speechRate === rate
                  ? 'bg-[#0F766E] border-[#0F766E] text-white'
                  : 'bg-[#FAF9F6] border-slate-200 text-slate-700'
              }`}
            >
              {rate === 0.75 ? '0.75x (Chậm rõ)' : '1.0x (Chuẩn)'}
            </button>
          ))}
        </div>
      </section>

      {/* Bi & Nhi Profiles */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] border border-[#C2410C]/20 text-[#C2410C] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1E293B]">Hồ sơ Bi &amp; Nhi</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chuyển đổi nhanh giữa hai hồ sơ độc lập. Mỗi người có mục tiêu HSK, chuỗi ngày học, lịch ôn SM-2 và bảng kỷ lục riêng.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(['bi', 'nhi']).map((pid) => {
            const p = PROFILES[pid];
            const active = activeProfileId === pid;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => switchProfile(pid)}
                className={`btn-tactile p-4 rounded-xl border text-left cursor-pointer ${
                  active
                    ? pid === 'bi'
                      ? 'bg-[#F0FDFA] border-[#0F766E]/50'
                      : 'bg-[#FFF7ED] border-[#C2410C]/50'
                    : 'bg-[#FAF9F6] border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#1E293B]">{p.name}</span>
                  <span className="font-hanzi-serif text-lg opacity-80">{p.hanziMark}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {active ? 'Đang hoạt động' : 'Nhấn để chuyển sang hồ sơ này'}
                </p>
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Làm mới dữ liệu học tập cho riêng hồ sơ <strong>{activeProfile.name}</strong>:
          </p>
          <button
            type="button"
            onClick={handleResetProfileProgress}
            className="btn-tactile inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100/70 text-xs font-semibold text-red-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại tiến độ của {activeProfile.name}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

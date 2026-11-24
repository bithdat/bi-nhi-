import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Languages,
  PenTool,
  MessageCircle,
  Sparkles,
  Send,
  Mic,
  MicOff,
  BookmarkPlus,
  RefreshCw,
  Loader2,
  AlertCircle,
  Check,
  Volume2,
} from 'lucide-react';
import { db } from '../db/database';
import { useApp } from '../context/AppContext';
import { HSK_LEVELS, TRANSLATION_TOPICS, ROLEPLAY_SCENARIOS } from '../constants/hsk';
import { callAiEndpoint } from '../utils/aiClient';
import { speakChinese, isSpeechRecognitionSupported, startChineseRecognition } from '../utils/speech';
import { SpeakButton } from '../components/common/SpeakButton';

export function AiStudio({ onNavigate }) {
  const {
    activeProfileId,
    targetLevels,
    personalApiKey,
    speechRate,
    recordStudyActivity,
    showToast,
  } = useApp();

  const [mode, setMode] = useState('translate'); // 'translate' | 'sentence' | 'roleplay'
  const [aiLevel, setAiLevel] = useState(targetLevels[0] || 'HSK2');

  // --- Mode 1: Bilingual Translation ---
  const [direction, setDirection] = useState('zh-vi'); // 'zh-vi' | 'vi-zh'
  const [topic, setTopic] = useState(TRANSLATION_TOPICS[0]);
  const [sourceText, setSourceText] = useState('我每天早上七点起床，喝一杯热茶后去上班。');
  const [sourcePinyin, setSourcePinyin] = useState('Wǒ měitiān zǎoshang qī diǎn qǐchuáng, hē yì bēi rè chá hòu qù shàngbān.');
  const [sourceHint, setSourceHint] = useState('');
  const [userTranslation, setUserTranslation] = useState('');
  const [transLoading, setTransLoading] = useState(false);
  const [transResult, setTransResult] = useState(null);
  const [savedVocabSet, setSavedVocabSet] = useState(new Set());
  const [aiError, setAiError] = useState(null);
  const [activeModel, setActiveModel] = useState('gemini-3.8-flash');

  const handleAiErr = (err) => {
    setAiError({
      message: err?.message || 'Lỗi khi kết nối trợ lý AI.',
      code: err?.code || 'AI_ERROR',
    });
  };

  // --- Mode 2: Sentence Grader ---
  const [targetWords, setTargetWords] = useState([]);
  const [userSentence, setUserSentence] = useState('');
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeResult, setGradeResult] = useState(null);

  // --- Mode 3: AI Roleplay ---
  const [scenario, setScenario] = useState(ROLEPLAY_SCENARIOS[0]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showRoleplayAid, setShowRoleplayAid] = useState(true);
  const [listeningMic, setListeningMic] = useState(false);
  const recognitionRef = useRef(null);

  const recentLogs = useLiveQuery(
    () =>
      db.translationLogs
        .where('profileId')
        .equals(activeProfileId)
        .reverse()
        .limit(8)
        .toArray(),
    [activeProfileId]
  );

  useEffect(() => {
    if (!targetLevels.includes(aiLevel)) {
      setAiLevel(targetLevels[0] || 'HSK2');
    }
  }, [targetLevels.join(','), aiLevel]);

  const pickRandomWordsForSentence = async (lvl = aiLevel) => {
    const pool = await db.vocab.where('level').equals(lvl).toArray();
    if (!pool.length) return;
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 2);
    setTargetWords(picked);
    setUserSentence('');
    setGradeResult(null);
    setAiError(null);
  };

  useEffect(() => {
    pickRandomWordsForSentence(aiLevel);
  }, [aiLevel]);

  // --- Handlers: Translation ---
  const handleGeneratePassage = async () => {
    setAiError(null);
    setTransLoading(true);
    setTransResult(null);
    try {
      const res = await callAiEndpoint(
        '/api/translate-grade',
        { action: 'generate', direction, level: aiLevel, topic },
        personalApiKey
      );
      if (res._model) setActiveModel(res._model);
      setSourceText(res.source_text || '');
      setSourcePinyin(res.source_pinyin || '');
      setSourceHint(res.hint || '');
      setUserTranslation('');
    } catch (err) {
      handleAiErr(err);
    } finally {
      setTransLoading(false);
    }
  };

  const handleGradeTranslation = async () => {
    if (!sourceText.trim() || !userTranslation.trim()) {
      showToast('Vui lòng nhập đầy đủ văn bản gốc và bản dịch của bạn.', 'warning');
      return;
    }
    setAiError(null);
    setTransLoading(true);
    try {
      const res = await callAiEndpoint(
        '/api/translate-grade',
        {
          action: 'grade',
          direction,
          level: aiLevel,
          topic,
          sourceText,
          userTranslation,
        },
        personalApiKey
      );
      if (res._model) setActiveModel(res._model);
      setTransResult(res);
      recordStudyActivity();
      await db.translationLogs.add({
        profileId: activeProfileId,
        mode: 'translate',
        direction,
        level: aiLevel,
        sourceText,
        userTranslation,
        score: Number(res.score) || 0,
        createdAt: Date.now(),
      });
    } catch (err) {
      handleAiErr(err);
    } finally {
      setTransLoading(false);
    }
  };

  const handleSaveAiVocab = async (word) => {
    await db.vocab.put({
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      level: aiLevel,
      hanzi: word.hanzi,
      pinyin: word.pinyin || '',
      meaning: word.meaning || '',
      example_zh: word.example_zh || '',
      example_vi: word.example_vi || '',
      createdAt: Date.now(),
    });
    setSavedVocabSet((prev) => new Set(prev).add(word.hanzi));
    showToast(`Đã lưu "${word.hanzi}" vào kho từ vựng ${aiLevel}!`);
  };

  // --- Handlers: Sentence Grader ---
  const handleGradeSentence = async () => {
    if (!userSentence.trim()) {
      showToast('Hãy nhập câu tiếng Trung bạn đặt nhé.', 'warning');
      return;
    }
    setAiError(null);
    setGradeLoading(true);
    try {
      const res = await callAiEndpoint(
        '/api/grade',
        { targetWords, userSentence, level: aiLevel },
        personalApiKey
      );
      if (res._model) setActiveModel(res._model);
      setGradeResult(res);
      recordStudyActivity();
      await db.translationLogs.add({
        profileId: activeProfileId,
        mode: 'sentence',
        direction: 'zh',
        level: aiLevel,
        sourceText: targetWords.map((w) => w.hanzi).join(', '),
        userTranslation: userSentence,
        score: Number(res.score) || 0,
        createdAt: Date.now(),
      });
    } catch (err) {
      handleAiErr(err);
    } finally {
      setGradeLoading(false);
    }
  };

  // --- Handlers: Roleplay ---
  const startRoleplaySession = async (sc = scenario) => {
    setScenario(sc);
    setMessages([]);
    setAiError(null);
    setChatLoading(true);
    try {
      const res = await callAiEndpoint(
        '/api/roleplay',
        {
          scenario: sc.title,
          aiRole: sc.aiRole,
          level: aiLevel,
          isStart: true,
        },
        personalApiKey
      );
      if (res._model) setActiveModel(res._model);
      const aiMsg = {
        id: Date.now(),
        role: 'ai',
        zh: res.reply_zh,
        pinyin: res.reply_pinyin,
        vi: res.reply_vi,
        suggestion_zh: res.suggestion_zh,
        suggestion_pinyin: res.suggestion_pinyin,
        suggestion_vi: res.suggestion_vi,
      };
      setMessages([aiMsg]);
      speakChinese(res.reply_zh, speechRate);
    } catch (err) {
      handleAiErr(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendRoleplay = async (textToSend = chatInput) => {
    const clean = textToSend.trim();
    if (!clean || chatLoading) return;

    const userMsg = { id: Date.now(), role: 'user', zh: clean };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setChatInput('');
    setAiError(null);
    setChatLoading(true);

    try {
      const res = await callAiEndpoint(
        '/api/roleplay',
        {
          scenario: scenario.title,
          aiRole: scenario.aiRole,
          level: aiLevel,
          history: nextHistory,
          userMessage: clean,
          isStart: false,
        },
        personalApiKey
      );
      if (res._model) setActiveModel(res._model);
      const aiMsg = {
        id: Date.now() + 1,
        role: 'ai',
        zh: res.reply_zh,
        pinyin: res.reply_pinyin,
        vi: res.reply_vi,
        feedback: res.feedback,
        suggestion_zh: res.suggestion_zh,
        suggestion_pinyin: res.suggestion_pinyin,
        suggestion_vi: res.suggestion_vi,
      };
      setMessages((prev) => [...prev, aiMsg]);
      recordStudyActivity();
      speakChinese(res.reply_zh, speechRate);
    } catch (err) {
      handleAiErr(err);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleMic = () => {
    if (listeningMic) {
      recognitionRef.current?.stop();
      setListeningMic(false);
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      showToast('Trình duyệt không hỗ trợ SpeechRecognition (nên dùng Chrome/Edge).', 'warning');
      return;
    }
    setListeningMic(true);
    recognitionRef.current = startChineseRecognition({
      onResult: (transcript) => setChatInput(transcript),
      onEnd: () => setListeningMic(false),
      onError: (msg) => {
        setListeningMic(false);
        showToast(msg, 'warning');
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#C2410C]">
            Trợ lý AI • {activeModel} (tự động dự phòng khi quá tải)
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B] mt-1">
            Luyện Dịch, Đặt Câu &amp; Giao Tiếp
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={aiLevel}
            onChange={(e) => setAiLevel(e.target.value)}
            aria-label="Chọn cấp độ AI"
            className="min-h-[40px] px-3 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-[#1E293B]"
          >
            {HSK_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                Trình độ: {l.label}
              </option>
            ))}
          </select>

          <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200/80">
            {[
              { id: 'translate', label: 'Luyện Dịch', icon: Languages },
              { id: 'sentence', label: 'Đặt Câu', icon: PenTool },
              { id: 'roleplay', label: 'Roleplay', icon: MessageCircle },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  id={`ai-mode-${m.id}`}
                  type="button"
                  onClick={() => {
                    setMode(m.id);
                    setAiError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    mode === m.id ? 'bg-[#0F766E] text-white' : 'text-slate-600 hover:text-[#1E293B]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* API Error Notice */}
      {aiError && (
        <div className="rounded-2xl bg-[#FFF7ED] border border-[#C2410C]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-[#9A3412]">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C2410C]" />
            <span>{aiError.message}</span>
          </div>
          {aiError.code === 'MISSING_API_KEY' || aiError.code === 'INVALID_API_KEY' ? (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="btn-tactile shrink-0 px-3.5 py-2 rounded-xl bg-white border border-[#C2410C]/30 text-xs font-semibold text-[#C2410C] cursor-pointer"
            >
              Kiểm tra Gemini API Key →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAiError(null)}
              className="btn-tactile shrink-0 px-3.5 py-2 rounded-xl bg-white border border-[#C2410C]/30 text-xs font-semibold text-[#C2410C] cursor-pointer"
            >
              Đóng thông báo
            </button>
          )}
        </div>
      )}

      {/* MODE 1: BILINGUAL TRANSLATION */}
      {mode === 'translate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex bg-[#FAF9F6] p-1 rounded-xl border border-slate-200/80 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection('zh-vi');
                      setTransResult(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      direction === 'zh-vi' ? 'bg-[#0F766E] text-white' : 'text-slate-600'
                    }`}
                  >
                    Trung → Việt
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirection('vi-zh');
                      setTransResult(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      direction === 'vi-zh' ? 'bg-[#0F766E] text-white' : 'text-slate-600'
                    }`}
                  >
                    Việt → Trung
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="min-h-[38px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-xs font-medium text-slate-700"
                  >
                    {TRANSLATION_TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={transLoading}
                    onClick={handleGeneratePassage}
                    className="btn-tactile inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl bg-[#F0FDFA] border border-[#0F766E]/25 text-xs font-semibold text-[#0F766E] cursor-pointer"
                  >
                    {transLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Tạo đề mới</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-500">
                    Đoạn văn gốc ({direction === 'zh-vi' ? 'Tiếng Trung — có thể tự sửa' : 'Tiếng Việt — có thể tự nhập'})
                  </label>
                  {direction === 'zh-vi' && sourceText && (
                    <SpeakButton text={sourceText} size="sm" label="Nghe" />
                  )}
                </div>
                <textarea
                  rows={3}
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/90 focus:border-[#0F766E] focus:bg-white focus:outline-none text-base font-hanzi"
                />
                {sourcePinyin && direction === 'zh-vi' && (
                  <p className="text-xs text-[#0F766E] mt-1.5">{sourcePinyin}</p>
                )}
                {sourceHint && <p className="text-xs text-slate-500 mt-1">Gợi ý: {sourceHint}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">
                  Bản dịch của bạn ({direction === 'zh-vi' ? 'Tiếng Việt' : 'Tiếng Trung giản thể'})
                </label>
                <textarea
                  rows={3}
                  value={userTranslation}
                  onChange={(e) => setUserTranslation(e.target.value)}
                  placeholder={
                    direction === 'zh-vi'
                      ? 'Nhập bản dịch tiếng Việt tự nhiên của bạn...'
                      : 'Nhập bản dịch tiếng Trung của bạn...'
                  }
                  className="w-full p-3.5 rounded-xl bg-white border border-slate-200/90 focus:border-[#0F766E] focus:outline-none text-sm sm:text-base font-hanzi"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={transLoading}
                  onClick={handleGradeTranslation}
                  className="btn-tactile inline-flex items-center gap-2 min-h-[46px] px-6 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
                >
                  {transLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Chấm bài dịch với AI</span>
                </button>
              </div>
            </div>

            {/* Grading Result */}
            {transResult && (
              <div className="bg-white rounded-2xl border border-[#0F766E]/30 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
                      Kết quả chấm bài AI
                    </p>
                    <h3 className="text-lg font-bold text-[#1E293B] mt-0.5">Phản hồi chi tiết</h3>
                  </div>
                  <div className="px-4 py-2 rounded-2xl bg-[#F0FDFA] border border-[#0F766E]/25 text-center">
                    <span className="text-2xl font-extrabold text-[#0F766E]">{transResult.score}</span>
                    <span className="text-xs text-slate-500"> / 10</span>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Độ chính xác</p>
                    <p className="text-[#1E293B] mt-1 leading-relaxed">{transResult.accuracy_feedback}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Ngữ pháp &amp; Từ vựng</p>
                    <p className="text-slate-700 mt-1 leading-relaxed">{transResult.grammar_vocabulary_notes}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[#0F766E] uppercase">Bản dịch chuẩn</p>
                      {direction === 'vi-zh' && transResult.standard_translation && (
                        <SpeakButton text={transResult.standard_translation} size="sm" />
                      )}
                    </div>
                    <p className="text-base font-semibold text-[#1E293B] font-hanzi">
                      {transResult.standard_translation}
                    </p>
                    {transResult.standard_pinyin && (
                      <p className="text-xs text-[#0F766E]">{transResult.standard_pinyin}</p>
                    )}
                  </div>

                  {Array.isArray(transResult.alternative_translations) &&
                    transResult.alternative_translations.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase">
                          2 Cách dịch tự nhiên hơn
                        </p>
                        {transResult.alternative_translations.map((alt, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs sm:text-sm space-y-0.5"
                          >
                            <p className="font-semibold text-[#1E293B] font-hanzi">
                              {typeof alt === 'string' ? alt : alt.text}
                            </p>
                            {alt.pinyin && <p className="text-xs text-[#0F766E]">{alt.pinyin}</p>}
                            {alt.nuance && <p className="text-xs text-slate-500">{alt.nuance}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                  {Array.isArray(transResult.new_vocabulary) && transResult.new_vocabulary.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-bold text-slate-500 uppercase">
                        Từ vựng nổi bật — Lưu nhanh vào Kho từ vựng
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {transResult.new_vocabulary.map((v, idx) => {
                          const saved = savedVocabSet.has(v.hanzi);
                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-[#FAF9F6] border border-slate-200/80 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="font-hanzi font-bold text-[#1E293B]">
                                  {v.hanzi}{' '}
                                  <span className="text-xs font-sans font-medium text-[#0F766E]">
                                    {v.pinyin}
                                  </span>
                                </p>
                                <p className="text-xs text-slate-600 truncate">{v.meaning}</p>
                              </div>
                              <button
                                type="button"
                                disabled={saved}
                                onClick={() => handleSaveAiVocab(v)}
                                className={`btn-tactile shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                                  saved
                                    ? 'bg-[#F0FDFA] text-[#0F766E] border border-[#0F766E]/25'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:border-[#0F766E]'
                                }`}
                              >
                                {saved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                                <span>{saved ? 'Đã lưu' : 'Lưu'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Translation Journal */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 h-fit space-y-3">
            <h3 className="text-sm font-bold text-[#1E293B]">Nhật ký luyện tập gần đây</h3>
            {!recentLogs || recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                Các bài luyện dịch và đặt câu được AI chấm sẽ tự động lưu tại đây theo từng hồ sơ.
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-[#FAF9F6] border border-slate-200/70 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0F766E]">
                        {log.level} • {log.mode === 'translate' ? log.direction.toUpperCase() : 'Đặt câu'}
                      </span>
                      <span className="font-bold text-[#C2410C]">{log.score}/10</span>
                    </div>
                    <p className="font-hanzi text-slate-700 line-clamp-2">{log.userTranslation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: SENTENCE GRADER */}
      {mode === 'sentence' && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
                  Từ khóa ngẫu nhiên từ kho {aiLevel}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hãy đặt 1 câu tiếng Trung hoàn chỉnh chứa các từ dưới đây
                </p>
              </div>
              <button
                type="button"
                onClick={() => pickRandomWordsForSentence(aiLevel)}
                className="btn-tactile inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200/90 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Đổi từ khác</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {targetWords.map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 rounded-xl bg-[#F0FDFA] border border-[#0F766E]/20 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-hanzi-serif text-xl font-bold text-[#1E293B]">{w.hanzi}</p>
                    <p className="text-xs text-[#0F766E] font-medium">{w.pinyin}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{w.meaning}</p>
                  </div>
                  <SpeakButton text={w.hanzi} size="icon" />
                </div>
              ))}
            </div>

            <textarea
              rows={3}
              value={userSentence}
              onChange={(e) => setUserSentence(e.target.value)}
              placeholder="Viết câu tiếng Trung của bạn tại đây..."
              className="w-full p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/90 focus:border-[#0F766E] focus:bg-white focus:outline-none text-base font-hanzi"
            />

            <div className="flex justify-end">
              <button
                type="button"
                disabled={gradeLoading}
                onClick={handleGradeSentence}
                className="btn-tactile inline-flex items-center gap-2 min-h-[46px] px-6 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                {gradeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Chấm ngữ pháp với AI</span>
              </button>
            </div>
          </div>

          {gradeResult && (
            <div className="bg-white rounded-2xl border border-[#0F766E]/30 p-5 space-y-3.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                  Nhận xét ngữ pháp AI
                </span>
                <span className="text-xl font-extrabold text-[#0F766E]">{gradeResult.score}/10</span>
              </div>
              <p className="text-[#1E293B] leading-relaxed">{gradeResult.grammar_feedback}</p>
              <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F766E]">Câu hoàn chỉnh chuẩn bản xứ</span>
                  <SpeakButton text={gradeResult.corrected_sentence} size="sm" />
                </div>
                <p className="font-hanzi text-base font-semibold text-[#1E293B]">
                  {gradeResult.corrected_sentence}
                </p>
                <p className="text-xs text-[#0F766E]">{gradeResult.corrected_pinyin}</p>
                <p className="text-xs text-slate-500">{gradeResult.corrected_vi}</p>
              </div>
              {gradeResult.grammar_tip && (
                <p className="text-xs text-[#9A3412] bg-[#FFF7ED] border border-[#C2410C]/20 p-3 rounded-xl">
                  <strong>Mẹo HSK 3.0:</strong> {gradeResult.grammar_tip}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODE 3: AI ROLEPLAY */}
      {mode === 'roleplay' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Scenario Picker */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Chọn tình huống giao tiếp
            </p>
            {ROLEPLAY_SCENARIOS.map((sc) => {
              const active = scenario.id === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => startRoleplaySession(sc)}
                  className={`btn-tactile w-full text-left p-3.5 rounded-2xl border cursor-pointer ${
                    active
                      ? 'bg-[#F0FDFA] border-[#0F766E]/50'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#1E293B]">{sc.title}</span>
                    <span className="font-hanzi text-xs text-[#0F766E]">{sc.subtitle}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{sc.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Chat Workspace */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 flex flex-col min-h-[480px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#1E293B]">
                  {scenario.title} ({aiLevel})
                </h3>
                <p className="text-xs text-slate-500">{scenario.aiRole}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRoleplayAid((v) => !v)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#FAF9F6] border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  {showRoleplayAid ? 'Ẩn Pinyin/Dịch' : 'Hiện Pinyin/Dịch'}
                </button>
                <button
                  type="button"
                  onClick={() => startRoleplaySession(scenario)}
                  className="btn-tactile px-3 py-1.5 rounded-lg bg-[#0F766E] text-white text-xs font-semibold cursor-pointer"
                >
                  Bắt đầu mới
                </button>
              </div>
            </div>

            <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[440px]">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-3">
                  <p className="text-sm font-semibold text-[#1E293B]">
                    Bắt đầu hội thoại tình huống “{scenario.title}”
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Trợ lý AI sẽ nhập vai người bản xứ, điều chỉnh từ vựng theo chuẩn {aiLevel} và tự động phát âm tiếng Trung.
                  </p>
                  <button
                    type="button"
                    disabled={chatLoading}
                    onClick={() => startRoleplaySession(scenario)}
                    className="btn-tactile inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#0F766E] text-white text-sm font-semibold cursor-pointer"
                  >
                    {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                    <span>Mở lời thoại</span>
                  </button>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm space-y-1 ${
                        m.role === 'user'
                          ? 'bg-[#0F766E] text-white'
                          : 'bg-[#FAF9F6] border border-slate-200/80 text-[#1E293B]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-hanzi text-base leading-relaxed">{m.zh}</p>
                        {m.role === 'ai' && (
                          <button
                            type="button"
                            onClick={() => speakChinese(m.zh, speechRate)}
                            className="p-1 rounded-lg hover:bg-white text-[#0F766E] shrink-0 cursor-pointer"
                            aria-label="Nghe lại"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {m.role === 'ai' && showRoleplayAid && (
                        <>
                          {m.pinyin && <p className="text-xs text-[#0F766E]">{m.pinyin}</p>}
                          {m.vi && <p className="text-xs text-slate-500">{m.vi}</p>}
                        </>
                      )}
                    </div>

                    {m.feedback && (
                      <p className="mt-1.5 max-w-[85%] text-[11px] text-[#9A3412] bg-[#FFF7ED] border border-[#C2410C]/20 px-3 py-1.5 rounded-xl">
                        Góp ý: {m.feedback}
                      </p>
                    )}

                    {m.suggestion_zh && m.id === messages[messages.length - 1]?.id && (
                      <button
                        type="button"
                        onClick={() => setChatInput(m.suggestion_zh)}
                        className="mt-2 text-left max-w-[85%] text-xs px-3 py-2 rounded-xl bg-white border border-dashed border-[#0F766E]/40 text-slate-600 hover:bg-[#F0FDFA] cursor-pointer"
                      >
                        <span className="font-semibold text-[#0F766E]">Gợi ý đáp lại: </span>
                        <span className="font-hanzi text-[#1E293B]">{m.suggestion_zh}</span>
                        {m.suggestion_vi && <span className="text-slate-400"> ({m.suggestion_vi})</span>}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Chat Input + Voice Mic */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendRoleplay();
              }}
              className="p-3.5 border-t border-slate-100 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleMic}
                title="Bấm để nói tiếng Trung (SpeechRecognition)"
                className={`btn-tactile w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer ${
                  listeningMic
                    ? 'bg-[#C2410C] border-[#C2410C] text-white animate-pulse'
                    : 'bg-[#FAF9F6] border-slate-200 text-slate-600 hover:text-[#0F766E]'
                }`}
              >
                {listeningMic ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  listeningMic
                    ? 'Đang nghe giọng tiếng Trung của bạn...'
                    : 'Nhập tiếng Trung hoặc bấm micro để nói...'
                }
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/90 focus:border-[#0F766E] focus:bg-white focus:outline-none text-sm font-hanzi"
              />

              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="btn-tactile min-h-[44px] px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="hidden sm:inline">Gửi</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

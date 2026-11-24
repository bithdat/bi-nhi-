import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import confetti from 'canvas-confetti';
import {
  Clock,
  Volume2,
  CheckCircle2,
  XCircle,
  Upload,
  FileJson,
  Play,
  ArrowRight,
  RotateCcw,
  Award,
  ClipboardList,
  BookOpen,
  History,
} from 'lucide-react';
import { db } from '../db/database';
import { getAllExams } from '../db/seed';
import { useApp } from '../context/AppContext';
import { HSK_LEVELS } from '../constants/hsk';
import { speakChinese, stopSpeaking } from '../utils/speech';

function formatClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function ExamRoom() {
  const { activeProfileId, activeProfile, targetLevels, speechRate, recordStudyActivity, showToast } =
    useApp();

  const [tab, setTab] = useState('real'); // 'real' | 'practice' | 'history'

  // --- Practice Quiz State ---
  const [quizLevel, setQuizLevel] = useState(targetLevels[0] || 'HSK1');
  const [quizCount, setQuizCount] = useState(10);
  const [quizType, setQuizType] = useState('mixed'); // mixed | zh-vi | vi-zh | listen
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // --- Real Exam Simulation State ---
  const [exams, setExams] = useState([]);
  const [showAllExamLevels, setShowAllExamLevels] = useState(false);
  const [activeExam, setActiveExam] = useState(null);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [examAnswers, setExamAnswers] = useState({});
  const [replayCounts, setReplayCounts] = useState({});
  const [examResult, setExamResult] = useState(null);
  const examFileRef = useRef(null);

  const history = useLiveQuery(
    () =>
      db.examHistory
        .where('profileId')
        .equals(activeProfileId)
        .reverse()
        .sortBy('createdAt'),
    [activeProfileId]
  );

  const loadExams = useCallback(async () => {
    const list = await getAllExams();
    setExams(list);
  }, []);

  useEffect(() => {
    loadExams();
    return () => stopSpeaking();
  }, [loadExams]);

  useEffect(() => {
    if (!targetLevels.includes(quizLevel)) {
      setQuizLevel(targetLevels[0] || 'HSK1');
    }
  }, [targetLevels.join(','), quizLevel]);

  // --- Practice Quiz Logic ---
  const startPracticeQuiz = async () => {
    const pool = await db.vocab.where('level').equals(quizLevel).toArray();
    if (pool.length < 4) {
      showToast('Cần ít nhất 4 từ vựng ở cấp độ này để tạo bài luyện tập.', 'warning');
      return;
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(quizCount, pool.length));
    const types = ['zh-vi', 'vi-zh', 'listen'];

    const qs = shuffled.map((word, idx) => {
      const qType = quizType === 'mixed' ? types[idx % types.length] : quizType;
      const distractors = [];
      const used = new Set([word.id]);
      let guard = 0;
      while (distractors.length < 3 && guard < 120) {
        guard++;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (!used.has(pick.id)) {
          used.add(pick.id);
          distractors.push(pick);
        }
      }
      const choices = [word, ...distractors].sort(() => Math.random() - 0.5);
      const answerIdx = choices.findIndex((c) => c.id === word.id);

      return {
        id: `pq-${idx}`,
        qType,
        word,
        options: choices.map((c) =>
          qType === 'vi-zh' ? `${c.hanzi} (${c.pinyin})` : c.meaning
        ),
        answer: answerIdx,
      };
    });

    setQuizQuestions(qs);
    setQuizAnswers({});
    setQuizSubmitted(false);
  };

  const submitPracticeQuiz = async () => {
    let correct = 0;
    quizQuestions.forEach((q) => {
      if (quizAnswers[q.id] === q.answer) correct += 1;
    });
    const score = Math.round((correct / Math.max(1, quizQuestions.length)) * 100);
    setQuizSubmitted(true);
    recordStudyActivity();

    await db.examHistory.add({
      profileId: activeProfileId,
      examId: `practice-${quizLevel}-${Date.now()}`,
      title: `Luyện tập nhanh ${quizLevel} (${quizQuestions.length} câu)`,
      mode: 'practice',
      level: quizLevel,
      totalScore: score,
      maxScore: 100,
      passed: score >= 60,
      createdAt: Date.now(),
    });

    if (score >= 80) {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.65 } });
    }
  };

  // --- Real Exam Simulation Logic ---
  const startRealExam = (exam) => {
    stopSpeaking();
    setActiveExam(exam);
    setSectionIdx(0);
    setTimeLeft(exam.sections[0]?.durationSec || 600);
    setExamAnswers({});
    setReplayCounts({});
    setExamResult(null);
  };

  const finishRealExam = useCallback(
    async (exam, answers) => {
      stopSpeaking();
      const sectionBreakdown = exam.sections.map((sec) => {
        let earned = 0;
        const perQ = sec.maxScore / Math.max(1, sec.questions.length);

        const items = sec.questions.map((q) => {
          const userAns = answers[q.id];
          let isCorrect = false;
          let partialRatio = 0;

          if (q.type === 'mcq') {
            isCorrect = userAns === q.answer;
            partialRatio = isCorrect ? 1 : 0;
          } else if (q.type === 'reorder') {
            const joined = Array.isArray(userAns) ? userAns.join('') : String(userAns || '');
            const cleanUser = joined.replace(/[\s。.,，!?！？]/g, '');
            const cleanExp = String(q.expected || '').replace(/[\s。.,，!?！？]/g, '');
            isCorrect = cleanUser === cleanExp;
            partialRatio = isCorrect ? 1 : 0;
          } else if (q.type === 'compose') {
            const txt = String(userAns || '').trim();
            const zhChars = (txt.match(/[\u4e00-\u9fff]/g) || []).length;
            const kws = q.keywords || [];
            const matchedKws = kws.filter((kw) => txt.includes(kw)).length;
            const kwScore = kws.length ? matchedKws / kws.length : 1;
            const lenScore = Math.min(1, zhChars / (q.minChars || 6));
            partialRatio = zhChars === 0 ? 0 : Math.min(1, kwScore * 0.65 + lenScore * 0.35);
            isCorrect = partialRatio >= 0.7;
          }

          earned += perQ * partialRatio;
          return {
            question: q,
            userAns,
            isCorrect,
            points: Math.round(perQ * partialRatio),
            maxPoints: Math.round(perQ),
          };
        });

        return {
          id: sec.id,
          title: sec.title,
          score: Math.min(sec.maxScore, Math.round(earned)),
          maxScore: sec.maxScore,
          items,
        };
      });

      const totalScore = sectionBreakdown.reduce((s, b) => s + b.score, 0);
      const passed = totalScore >= (exam.passingScore || Math.round(exam.maxScore * 0.6));

      const resultObj = {
        exam,
        sectionBreakdown,
        totalScore,
        maxScore: exam.maxScore,
        passingScore: exam.passingScore,
        passed,
      };

      setExamResult(resultObj);
      recordStudyActivity();

      await db.examHistory.add({
        profileId: activeProfileId,
        examId: exam.id,
        title: exam.title,
        mode: 'real',
        level: exam.level,
        totalScore,
        maxScore: exam.maxScore,
        passed,
        sectionScores: sectionBreakdown.map((s) => ({ title: s.title, score: s.score, maxScore: s.maxScore })),
        createdAt: Date.now(),
      });

      if (passed) {
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
      }
    },
    [activeProfileId, recordStudyActivity]
  );

  const handleAdvanceSection = useCallback(() => {
    if (!activeExam) return;
    stopSpeaking();
    if (sectionIdx + 1 < activeExam.sections.length) {
      const nextIdx = sectionIdx + 1;
      setSectionIdx(nextIdx);
      setTimeLeft(activeExam.sections[nextIdx].durationSec || 600);
      showToast(`Đã chuyển sang ${activeExam.sections[nextIdx].title}`, 'info');
    } else {
      finishRealExam(activeExam, examAnswers);
    }
  }, [activeExam, sectionIdx, examAnswers, finishRealExam, showToast]);

  // Countdown timer per section with auto-advance
  useEffect(() => {
    if (!activeExam || examResult) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          handleAdvanceSection();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [activeExam, sectionIdx, examResult, handleAdvanceSection]);

  const handlePlayListening = (q, maxReplays) => {
    const used = replayCounts[q.id] || 0;
    if (used >= maxReplays) {
      showToast(`Đã hết ${maxReplays} lượt nghe cho câu này theo quy chế thi thật.`, 'warning');
      return;
    }
    setReplayCounts((prev) => ({ ...prev, [q.id]: used + 1 }));
    speakChinese(q.audioText, speechRate);
  };

  // Import custom Exam JSON
  const handleImportExamJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const items = Array.isArray(parsed) ? parsed : [parsed];
        const valid = items.filter((ex) => ex && ex.title && Array.isArray(ex.sections) && ex.sections.length > 0);
        if (valid.length === 0) {
          showToast('Tệp JSON đề thi không hợp lệ (cần có title và sections).', 'error');
          return;
        }
        const prepared = valid.map((ex, i) => ({
          ...ex,
          id: ex.id || `custom-exam-${Date.now()}-${i}`,
          level: ex.level || targetLevels[0] || 'HSK1',
          maxScore: ex.maxScore || ex.sections.length * 100,
          passingScore: ex.passingScore || Math.round((ex.maxScore || ex.sections.length * 100) * 0.6),
          createdAt: Date.now(),
        }));
        await db.customExams.bulkPut(prepared);
        await loadExams();
        showToast(`Đã nạp thành công ${prepared.length} đề thi mới!`);
      } catch {
        showToast('Không thể đọc tệp JSON đề thi.', 'error');
      } finally {
        if (examFileRef.current) examFileRef.current.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDownloadSampleExam = () => {
    const sample = exams[0] || {
      id: 'sample-hsk-exam',
      level: 'HSK1',
      title: 'Đề mẫu HSK 1 Tự soạn',
      passingScore: 120,
      maxScore: 200,
      sections: [],
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bi-nhi-hsk-mau-de-thi.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải mẫu JSON cấu trúc đề thi.');
  };

  // --- Active Real Exam View ---
  if (activeExam && !examResult) {
    const sec = activeExam.sections[sectionIdx];
    const maxReplays = sec.maxReplays || 2;
    const isUrgent = timeLeft <= 60;

    return (
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Official Exam iBT Top Bar */}
        <div className="sticky top-16 z-10 bg-white rounded-2xl border border-slate-200/90 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
              Phòng Thi HSK iBT • {activeExam.level} ({sectionIdx + 1}/{activeExam.sections.length})
            </p>
            <h2 className="text-base font-bold text-[#1E293B]">{sec.title}</h2>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-bold tabular-nums ${
                isUrgent
                  ? 'bg-red-50 border-red-300 text-red-700 animate-pulse'
                  : 'bg-[#FAF9F6] border-slate-200 text-[#1E293B]'
              }`}
            >
              <Clock className="w-4 h-4 text-[#C2410C]" />
              <span>{formatClock(timeLeft)}</span>
            </div>

            <button
              id="exam-next-section-btn"
              type="button"
              onClick={handleAdvanceSection}
              className="btn-tactile inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <span>
                {sectionIdx + 1 < activeExam.sections.length ? 'Chuyển phần tiếp' : 'Nộp bài thi'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section Instructions */}
        <div className="rounded-xl bg-[#F0FDFA] border border-[#0F766E]/20 px-4 py-3 text-xs sm:text-sm text-[#115E59]">
          {sec.instructions}
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {sec.questions.map((q, qIdx) => {
            const usedReplays = replayCounts[q.id] || 0;
            const remainingReplays = Math.max(0, maxReplays - usedReplays);

            return (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-slate-200 text-xs font-bold text-[#1E293B]">
                    Câu {qIdx + 1}
                  </span>

                  {q.audioText && (
                    <button
                      type="button"
                      disabled={remainingReplays <= 0}
                      onClick={() => handlePlayListening(q, maxReplays)}
                      className={`btn-tactile inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                        remainingReplays > 0
                          ? 'bg-[#0F766E] border-[#0F766E] text-white hover:bg-[#115E59]'
                          : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>
                        {remainingReplays > 0
                          ? `Nghe đoạn ghi âm (còn ${remainingReplays}/${maxReplays} lần)`
                          : 'Đã hết lượt nghe'}
                      </span>
                    </button>
                  )}
                </div>

                <p className="text-sm sm:text-base font-medium text-[#1E293B] whitespace-pre-line font-hanzi leading-relaxed">
                  {q.prompt}
                </p>

                {/* MCQ */}
                {q.type === 'mcq' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const picked = examAnswers[q.id] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => setExamAnswers((a) => ({ ...a, [q.id]: optIdx }))}
                          className={`btn-tactile text-left min-h-[46px] px-4 py-3 rounded-xl border text-sm cursor-pointer flex items-center gap-2.5 ${
                            picked
                              ? 'bg-[#F0FDFA] border-[#0F766E] text-[#0F766E] font-semibold'
                              : 'bg-[#FAF9F6] border-slate-200/80 text-[#1E293B] hover:border-slate-300'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              picked ? 'bg-[#0F766E] text-white' : 'bg-white border border-slate-200 text-slate-500'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="font-hanzi">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Reorder (HSK 3+ Writing) */}
                {q.type === 'reorder' && (() => {
                  const chosen = Array.isArray(examAnswers[q.id]) ? examAnswers[q.id] : [];
                  const available = q.tokens.filter((t) => {
                    const totalInQ = q.tokens.filter((x) => x === t).length;
                    const usedInA = chosen.filter((x) => x === t).length;
                    return usedInA < totalInQ;
                  });

                  return (
                    <div className="space-y-3">
                      <div className="min-h-[52px] p-3 rounded-xl bg-[#FAF9F6] border border-dashed border-slate-300 flex flex-wrap gap-2 items-center">
                        {chosen.length === 0 ? (
                          <span className="text-xs text-slate-400">
                            Bấm lần lượt các cụm từ bên dưới để ghép câu...
                          </span>
                        ) : (
                          chosen.map((tok, tIdx) => (
                            <button
                              key={`${tok}-${tIdx}`}
                              type="button"
                              onClick={() => {
                                const copy = [...chosen];
                                copy.splice(tIdx, 1);
                                setExamAnswers((a) => ({ ...a, [q.id]: copy }));
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#0F766E] text-white text-sm font-hanzi font-medium cursor-pointer"
                            >
                              {tok}
                            </button>
                          ))
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {available.map((tok, tIdx) => (
                          <button
                            key={`${tok}-avail-${tIdx}`}
                            type="button"
                            onClick={() =>
                              setExamAnswers((a) => ({ ...a, [q.id]: [...chosen, tok] }))
                            }
                            className="btn-tactile px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 hover:border-[#0F766E] text-sm font-hanzi font-medium text-[#1E293B] cursor-pointer"
                          >
                            {tok}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Compose (HSK 3+ Writing) */}
                {q.type === 'compose' && (() => {
                  const txt = String(examAnswers[q.id] || '');
                  const zhCount = (txt.match(/[\u4e00-\u9fff]/g) || []).length;
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-500">Từ khóa bắt buộc:</span>
                        {(q.keywords || []).map((kw) => {
                          const ok = txt.includes(kw);
                          return (
                            <span
                              key={kw}
                              className={`px-2.5 py-1 rounded-lg font-hanzi font-semibold border ${
                                ok
                                  ? 'bg-[#F0FDFA] border-[#0F766E]/40 text-[#0F766E]'
                                  : 'bg-[#FFF7ED] border-[#C2410C]/30 text-[#C2410C]'
                              }`}
                            >
                              {kw} {ok ? '✓' : ''}
                            </span>
                          );
                        })}
                        <span className="ml-auto text-slate-400">
                          {zhCount} / tối thiểu {q.minChars || 6} chữ Hán
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={txt}
                        onChange={(e) => setExamAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                        placeholder="Nhập câu tiếng Trung giản thể của bạn tại đây..."
                        className="w-full p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/90 focus:border-[#0F766E] focus:bg-white focus:outline-none text-base font-hanzi"
                      />
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setActiveExam(null);
            }}
            className="text-xs font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
          >
            Thoát phòng thi
          </button>
          <button
            type="button"
            onClick={handleAdvanceSection}
            className="btn-tactile inline-flex items-center gap-2 min-h-[46px] px-6 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold cursor-pointer"
          >
            <span>
              {sectionIdx + 1 < activeExam.sections.length
                ? `Hoàn tất & sang ${activeExam.sections[sectionIdx + 1].title}`
                : 'Nộp bài & Xem báo cáo chuẩn HSK'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // --- Real Exam Result Report ---
  if (examResult) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 text-center space-y-4">
          <div
            className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
              examResult.passed ? 'bg-[#F0FDFA] text-[#0F766E]' : 'bg-[#FFF7ED] text-[#C2410C]'
            }`}
          >
            <Award className="w-9 h-9" />
          </div>
          <div>
            <span
              className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
                examResult.passed
                  ? 'bg-[#F0FDFA] border-[#0F766E]/30 text-[#0F766E]'
                  : 'bg-[#FFF7ED] border-[#C2410C]/30 text-[#C2410C]'
              }`}
            >
              {examResult.passed ? 'ĐẠT CHUẨN HSK 3.0' : 'CHƯA ĐẠT — CẦN ÔN THÊM'}
            </span>
            <h2 className="text-2xl font-bold text-[#1E293B] mt-3">{examResult.exam.title}</h2>
            <div className="flex items-baseline justify-center gap-2 mt-2">
              <span className="text-4xl font-extrabold text-[#0F766E]">{examResult.totalScore}</span>
              <span className="text-base text-slate-400">/ {examResult.maxScore} điểm</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mức điểm đạt yêu cầu: {examResult.passingScore}/{examResult.maxScore}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            {examResult.sectionBreakdown.map((sec) => (
              <div key={sec.id} className="p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/70">
                <p className="text-xs font-semibold text-slate-500">{sec.title}</p>
                <p className="text-xl font-bold text-[#1E293B] mt-1">
                  {sec.score} <span className="text-xs font-normal text-slate-400">/ {sec.maxScore}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => startRealExam(examResult.exam)}
              className="btn-tactile inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-white border border-slate-200/90 text-sm font-semibold text-[#1E293B] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Làm lại đề này</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveExam(null);
                setExamResult(null);
              }}
              className="btn-tactile inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#0F766E] text-white text-sm font-semibold cursor-pointer"
            >
              <span>Về danh sách đề thi</span>
            </button>
          </div>
        </div>

        {/* Detailed Question Explanations */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-[#1E293B]">Giải thích chi tiết từng câu</h3>
          {examResult.sectionBreakdown.map((sec) => (
            <div key={sec.id} className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">{sec.title}</p>
              {sec.items.map((item, idx) => (
                <div
                  key={item.question.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1E293B] font-hanzi whitespace-pre-line">
                      Câu {idx + 1}: {item.question.prompt}
                    </p>
                    {item.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-[#0F766E] shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-[#C2410C] shrink-0" />
                    )}
                  </div>
                  {item.question.audioText && (
                    <p className="text-xs text-slate-600 bg-[#FAF9F6] p-2.5 rounded-lg font-hanzi">
                      <strong>Transcript:</strong> {item.question.audioText}
                    </p>
                  )}
                  <div className="text-xs space-y-1">
                    {item.question.type === 'mcq' && (
                      <p className="text-[#0F766E] font-semibold">
                        Đáp án chuẩn: {item.question.options[item.question.answer]}
                      </p>
                    )}
                    {item.question.type === 'reorder' && (
                      <p className="text-[#0F766E] font-semibold font-hanzi">
                        Câu chuẩn: {item.question.expected}
                      </p>
                    )}
                    {item.question.type === 'compose' && (
                      <p className="text-[#0F766E] font-semibold font-hanzi">
                        Câu tham khảo: {item.question.sampleAnswer}
                      </p>
                    )}
                    <p className="text-slate-500 leading-relaxed">{item.question.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const displayedExams = showAllExamLevels
    ? exams
    : exams.filter((ex) => targetLevels.includes(ex.level));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
            Phòng Thi Khảo Thí HSK 3.0 • {activeProfile.name}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E293B] mt-1">
            Luyện Tập &amp; Thi Thử Chuẩn iBT
          </h1>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/80">
          {[
            { id: 'real', label: 'Thi chuẩn HSK', icon: ClipboardList },
            { id: 'practice', label: 'Luyện nhanh', icon: BookOpen },
            { id: 'history', label: 'Lịch sử', icon: History },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                id={`exam-tab-${t.id}`}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  tab === t.id ? 'bg-[#0F766E] text-white' : 'text-slate-600 hover:text-[#1E293B]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: REAL EXAM SIMULATION */}
      {tab === 'real' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>
                Đang hiển thị đề cho mục tiêu: <strong className="text-[#1E293B]">{showAllExamLevels ? 'Tất cả 6 cấp' : targetLevels.join(', ')}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowAllExamLevels((v) => !v)}
                className="text-[#0F766E] font-semibold hover:underline cursor-pointer"
              >
                {showAllExamLevels ? '(Lọc theo mục tiêu)' : '(Xem tất cả HSK 1–6)'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={examFileRef}
                type="file"
                accept=".json"
                onChange={handleImportExamJson}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => examFileRef.current?.click()}
                className="btn-tactile inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl bg-[#F0FDFA] border border-[#0F766E]/25 text-xs font-semibold text-[#0F766E] cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Nạp đề JSON mới</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSampleExam}
                className="btn-tactile inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl bg-white border border-slate-200/90 text-xs font-medium text-slate-600 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mẫu JSON</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedExams.map((ex) => {
              const totalMins = Math.round(
                ex.sections.reduce((s, sec) => s + (sec.durationSec || 0), 0) / 60
              );
              return (
                <div
                  key={ex.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#F0FDFA] text-[#0F766E] border border-[#0F766E]/20">
                        {ex.level}
                      </span>
                      <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {totalMins} phút • {ex.sections.length} phần
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-[#1E293B] mt-3">{ex.title}</h2>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1.5">{ex.description}</p>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {ex.sections.map((s) => (
                        <span
                          key={s.id}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-[#FAF9F6] border border-slate-200/80 text-slate-600"
                        >
                          {s.title}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    id={`start-exam-${ex.id}`}
                    type="button"
                    onClick={() => startRealExam(ex)}
                    className="btn-tactile mt-5 w-full min-h-[44px] rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Vào phòng thi ngay</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: PRACTICE QUIZ */}
      {tab === 'practice' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-slate-600">Cấp độ HSK</label>
              <select
                value={quizLevel}
                onChange={(e) => setQuizLevel(e.target.value)}
                className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm"
              >
                {HSK_LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Số câu hỏi</label>
              <select
                value={quizCount}
                onChange={(e) => setQuizCount(Number(e.target.value))}
                className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm"
              >
                {[10, 15, 20, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} câu
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Dạng câu hỏi</label>
              <select
                value={quizType}
                onChange={(e) => setQuizType(e.target.value)}
                className="mt-1 w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F6] border border-slate-200 text-sm"
              >
                <option value="mixed">Hỗn hợp (Đọc + Nghe)</option>
                <option value="zh-vi">Chữ Hán → Nghĩa Việt</option>
                <option value="vi-zh">Nghĩa Việt → Chữ Hán</option>
                <option value="listen">Nghe tiếng Trung → Nghĩa</option>
              </select>
            </div>
            <button
              id="start-practice-quiz-btn"
              type="button"
              onClick={startPracticeQuiz}
              className="btn-tactile min-h-[42px] px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold cursor-pointer"
            >
              Tạo đề luyện tập
            </button>
          </div>

          {quizQuestions.length > 0 && (
            <div className="space-y-4">
              {quizSubmitted && (
                <div className="bg-[#F0FDFA] border border-[#0F766E]/30 rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#0F766E]">
                      Kết quả luyện tập nhanh
                    </p>
                    <p className="text-2xl font-bold text-[#1E293B] mt-1">
                      Đúng{' '}
                      {quizQuestions.filter((q) => quizAnswers[q.id] === q.answer).length}/
                      {quizQuestions.length} câu
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startPracticeQuiz}
                    className="btn-tactile min-h-[42px] px-4 rounded-xl bg-[#0F766E] text-white text-xs font-semibold cursor-pointer"
                  >
                    Tạo bộ câu mới
                  </button>
                </div>
              )}

              {quizQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-400">Câu {idx + 1}</span>
                    {q.qType === 'listen' && (
                      <button
                        type="button"
                        onClick={() => speakChinese(q.word.hanzi, speechRate)}
                        className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0FDFA] text-[#0F766E] border border-[#0F766E]/25 text-xs font-semibold cursor-pointer"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>Nghe phát âm</span>
                      </button>
                    )}
                  </div>

                  <p className="text-lg font-bold text-[#1E293B] font-hanzi-serif">
                    {q.qType === 'zh-vi'
                      ? `${q.word.hanzi} (${q.word.pinyin})`
                      : q.qType === 'vi-zh'
                      ? `Chọn chữ Hán cho nghĩa: "${q.word.meaning}"`
                      : 'Nghe và chọn nghĩa tiếng Việt đúng:'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => {
                      const picked = quizAnswers[q.id] === optIdx;
                      const isCorrectOpt = optIdx === q.answer;
                      let cls = 'bg-[#FAF9F6] border-slate-200/80 text-[#1E293B]';
                      if (quizSubmitted) {
                        if (isCorrectOpt) cls = 'bg-[#F0FDFA] border-[#0F766E] text-[#0F766E] font-semibold';
                        else if (picked) cls = 'bg-red-50 border-red-300 text-red-700';
                      } else if (picked) {
                        cls = 'bg-[#F0FDFA] border-[#0F766E] text-[#0F766E] font-semibold';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={quizSubmitted}
                          onClick={() => setQuizAnswers((a) => ({ ...a, [q.id]: optIdx }))}
                          className={`btn-tactile text-left min-h-[44px] px-4 py-2.5 rounded-xl border text-sm font-hanzi cursor-pointer ${cls}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {!quizSubmitted && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={submitPracticeQuiz}
                    className="btn-tactile min-h-[48px] px-7 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-sm font-semibold cursor-pointer"
                  >
                    Chấm điểm bài luyện tập
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXAM HISTORY */}
      {tab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          {!history || history.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              Chưa có lịch sử thi nào cho hồ sơ của {activeProfile.name}.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1E293B]">{item.title || item.examId}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.level} • {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-bold ${
                        item.passed ? 'text-[#0F766E]' : 'text-[#C2410C]'
                      }`}
                    >
                      {item.totalScore}/{item.maxScore || 100}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      {item.passed ? 'Đạt' : 'Chưa đạt'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

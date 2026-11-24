import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Volume2, Play, RotateCcw, Trophy, Flag, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../../db/database';
import { useApp } from '../../context/AppContext';
import { speakChinese } from '../../utils/speech';

const TOTAL_GATES = 10;
const CANVAS_W = 480;
const CANVAS_H = 540;

export function VocabLaneRacer() {
  const { activeProfileId, targetLevels, speechRate, recordStudyActivity } = useApp();

  const [answerType, setAnswerType] = useState('meaning'); // 'meaning' | 'pinyin'
  const [phase, setPhase] = useState('ready'); // ready | playing | gameover | victory
  const [hud, setHud] = useState({
    hanzi: '',
    pinyin: '',
    meaning: '',
    progress: 0,
    score: 0,
    elapsedMs: 0,
    lane: 1,
  });
  const [failInfo, setFailInfo] = useState(null);

  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const touchStartRef = useRef(null);
  const vocabPoolRef = useRef([]);

  useEffect(() => {
    db.vocab
      .where('level')
      .anyOf(targetLevels)
      .toArray()
      .then((list) => {
        vocabPoolRef.current = list;
      });
  }, [targetLevels.join(',')]);

  const buildQuestion = useCallback(
    (pool, usedIds) => {
      const candidates = pool.filter((w) => !usedIds.has(w.id));
      const source = candidates.length >= 3 ? candidates : pool;
      const target = source[Math.floor(Math.random() * source.length)];
      usedIds.add(target.id);

      const distractors = [];
      const seenLabels = new Set([answerType === 'pinyin' ? target.pinyin : target.meaning]);
      let guard = 0;
      while (distractors.length < 2 && guard < 150) {
        guard++;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const lbl = answerType === 'pinyin' ? pick.pinyin : pick.meaning;
        if (pick.id !== target.id && lbl && !seenLabels.has(lbl)) {
          seenLabels.add(lbl);
          distractors.push(pick);
        }
      }

      const correctLane = Math.floor(Math.random() * 3);
      const lanes = [null, null, null];
      lanes[correctLane] = {
        word: target,
        label: answerType === 'pinyin' ? target.pinyin : target.meaning,
        correct: true,
      };
      let dIdx = 0;
      for (let i = 0; i < 3; i++) {
        if (!lanes[i]) {
          const d = distractors[dIdx++] || target;
          lanes[i] = {
            word: d,
            label: answerType === 'pinyin' ? d.pinyin : d.meaning,
            correct: false,
          };
        }
      }

      return { target, correctLane, lanes };
    },
    [answerType]
  );

  const startGame = useCallback(async () => {
    let pool = vocabPoolRef.current;
    if (!pool || pool.length < 4) {
      pool = await db.vocab.where('level').anyOf(targetLevels).toArray();
      vocabPoolRef.current = pool;
    }
    if (!pool || pool.length < 4) return;

    const usedIds = new Set();
    const firstQ = buildQuestion(pool, usedIds);
    const now = performance.now();

    stateRef.current = {
      phase: 'playing',
      lane: 1,
      carX: CANVAS_W / 2,
      speed: 132, // px/sec, increases per gate
      roadOffset: 0,
      gateY: -70,
      progress: 0,
      score: 0,
      startTime: now,
      lastTime: now,
      usedIds,
      question: firstQ,
      particles: [],
      flashColor: null,
      flashAlpha: 0,
    };

    setFailInfo(null);
    setPhase('playing');
    setHud({
      hanzi: firstQ.target.hanzi,
      pinyin: firstQ.target.pinyin,
      meaning: firstQ.target.meaning,
      progress: 0,
      score: 0,
      elapsedMs: 0,
      lane: 1,
    });

    speakChinese(firstQ.target.hanzi, speechRate);
  }, [buildQuestion, speechRate, targetLevels]);

  const setLane = useCallback((nextLane) => {
    const st = stateRef.current;
    if (!st || st.phase !== 'playing') return;
    st.lane = Math.max(0, Math.min(2, nextLane));
    setHud((h) => ({ ...h, lane: st.lane }));
  }, []);

  const moveLane = useCallback(
    (delta) => {
      const st = stateRef.current;
      if (!st || st.phase !== 'playing') return;
      setLane(st.lane + delta);
    },
    [setLane]
  );

  // Keyboard controls
  useEffect(() => {
    const onKey = (e) => {
      if (stateRef.current?.phase !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        moveLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        moveLane(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveLane]);

  // Canvas 60fps Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawWrappedText = (text, cx, cy, maxW, lineH) => {
      const words = String(text || '').split(' ');
      const lines = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      const shown = lines.slice(0, 3);
      const startY = cy - ((shown.length - 1) * lineH) / 2;
      shown.forEach((ln, idx) => {
        ctx.fillText(ln, cx, startY + idx * lineH);
      });
    };

    const renderFrame = (now) => {
      const st = stateRef.current;
      const laneW = CANVAS_W / 3;
      const carY = CANVAS_H - 92;

      // Update physics if playing
      if (st && st.phase === 'playing') {
        const dt = Math.min(0.05, (now - st.lastTime) / 1000);
        st.lastTime = now;

        st.roadOffset = (st.roadOffset + st.speed * 1.9 * dt) % 48;
        st.gateY += st.speed * dt;

        const targetX = st.lane * laneW + laneW / 2;
        st.carX += (targetX - st.carX) * Math.min(1, dt * 16);

        if (st.flashAlpha > 0) {
          st.flashAlpha = Math.max(0, st.flashAlpha - dt * 2.5);
        }

        // Update particles
        st.particles = st.particles.filter((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          return p.life > 0;
        });

        // Gate collision check at car front
        if (st.gateY + 34 >= carY - 26) {
          const chosen = st.question.lanes[st.lane];
          if (chosen && chosen.correct) {
            const nextProgress = st.progress + 1;
            const nextScore = st.score + 100 + Math.round(st.speed * 0.25);
            const elapsed = Math.round(now - st.startTime);

            // Spawn jade celebration particles
            for (let i = 0; i < 18; i++) {
              const angle = Math.random() * Math.PI * 2;
              const spd = 80 + Math.random() * 140;
              st.particles.push({
                x: st.carX,
                y: carY - 20,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life: 0.45 + Math.random() * 0.25,
                color: i % 2 === 0 ? '#14B8A6' : '#F59E0B',
              });
            }
            st.flashColor = '#0F766E';
            st.flashAlpha = 0.25;

            if (nextProgress >= TOTAL_GATES) {
              st.phase = 'victory';
              st.progress = TOTAL_GATES;
              st.score = nextScore;
              setHud((h) => ({ ...h, progress: TOTAL_GATES, score: nextScore, elapsedMs: elapsed }));
              setPhase('victory');
              recordStudyActivity();
              db.gameScores.add({
                profileId: activeProfileId,
                game: 'racer',
                levelKey: targetLevels.join(','),
                score: nextScore,
                timeMs: elapsed,
                createdAt: Date.now(),
              });
              confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
            } else {
              st.progress = nextProgress;
              st.score = nextScore;
              st.speed = Math.min(265, st.speed + 13);
              st.gateY = -75;
              const nextQ = buildQuestion(vocabPoolRef.current, st.usedIds);
              st.question = nextQ;
              setHud({
                hanzi: nextQ.target.hanzi,
                pinyin: nextQ.target.pinyin,
                meaning: nextQ.target.meaning,
                progress: nextProgress,
                score: nextScore,
                elapsedMs: elapsed,
                lane: st.lane,
              });
              speakChinese(nextQ.target.hanzi, speechRate);
            }
          } else {
            // Game Over immediately
            st.phase = 'gameover';
            st.flashColor = '#C2410C';
            st.flashAlpha = 0.35;
            const elapsed = Math.round(now - st.startTime);
            setFailInfo({
              word: st.question.target,
              pickedLabel: chosen?.label || '',
              correctLabel: st.question.lanes[st.question.correctLane]?.label || '',
              score: st.score,
              progress: st.progress,
              elapsedMs: elapsed,
            });
            setPhase('gameover');
            recordStudyActivity();
          }
        }
      }

      // --- DRAW ROAD ---
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Subtle active lane highlight
      const activeLane = st ? st.lane : 1;
      ctx.fillStyle = 'rgba(15, 118, 110, 0.14)';
      ctx.fillRect(activeLane * laneW, 0, laneW, CANVAS_H);

      // Side road curbs
      ctx.fillStyle = '#0F766E';
      ctx.fillRect(0, 0, 6, CANVAS_H);
      ctx.fillRect(CANVAS_W - 6, 0, 6, CANVAS_H);

      // Dashed lane dividers
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.25)';
      ctx.lineWidth = 3;
      ctx.setLineDash([22, 26]);
      ctx.lineDashOffset = -(st?.roadOffset || 0);
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneW, 0);
        ctx.lineTo(i * laneW, CANVAS_H);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw 3 Horizontal Gates
      if (st && st.question && st.phase !== 'ready') {
        const gy = st.gateY;
        st.question.lanes.forEach((gate, idx) => {
          const gx = idx * laneW + 10;
          const gw = laneW - 20;
          const gh = 68;

          ctx.fillStyle = idx === activeLane ? '#FAF9F6' : '#F1F5F9';
          ctx.beginPath();
          ctx.roundRect(gx, gy - gh / 2, gw, gh, 12);
          ctx.fill();

          ctx.lineWidth = idx === activeLane ? 2.5 : 1.5;
          ctx.strokeStyle = idx === activeLane ? '#14B8A6' : '#94A3B8';
          ctx.stroke();

          ctx.fillStyle = '#1E293B';
          ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          drawWrappedText(gate.label, gx + gw / 2, gy, gw - 16, 17);
        });
      }

      // Draw Car
      const cx = st ? st.carX : CANVAS_W / 2;
      ctx.save();
      ctx.translate(cx, carY);

      // Soft shadow
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.roundRect(-24, -30, 48, 68, 14);
      ctx.fill();

      // Car chassis (Deep Jade sport coupe)
      ctx.fillStyle = '#0F766E';
      ctx.beginPath();
      ctx.roundRect(-22, -34, 44, 66, 13);
      ctx.fill();

      // Racing stripe
      ctx.fillStyle = '#FAF9F6';
      ctx.fillRect(-3, -34, 6, 66);

      // Windshield
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-16, -15, 32, 18, 5);
      ctx.fill();

      // Headlights
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(-16, -34, 8, 4);
      ctx.fillRect(8, -34, 8, 4);

      // Tail lights
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(-16, 28, 9, 4);
      ctx.fillRect(7, 28, 9, 4);

      ctx.restore();

      // Particles
      if (st?.particles?.length) {
        st.particles.forEach((p) => {
          ctx.globalAlpha = Math.max(0, p.life * 2);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      // Screen feedback flash
      if (st && st.flashAlpha > 0 && st.flashColor) {
        ctx.fillStyle = st.flashColor;
        ctx.globalAlpha = st.flashAlpha;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    };

    rafRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeProfileId, buildQuestion, recordStudyActivity, speechRate, targetLevels]);

  // Tap lane directly on canvas
  const handleCanvasPointerDown = (e) => {
    if (stateRef.current?.phase !== 'playing') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedLane = Math.min(2, Math.max(0, Math.floor((x / rect.width) * 3)));
    setLane(clickedLane);
    touchStartRef.current = e.clientX;
  };

  const handleCanvasPointerUp = (e) => {
    if (touchStartRef.current === null || stateRef.current?.phase !== 'playing') return;
    const dx = e.clientX - touchStartRef.current;
    touchStartRef.current = null;
    if (Math.abs(dx) > 40) {
      moveLane(dx > 0 ? 1 : -1);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Top Question Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
            Đua Xe Vượt Cổng Từ Vựng
          </p>
          <div className="flex items-center gap-3 mt-1">
            {phase === 'playing' ? (
              <>
                <span className="font-hanzi-serif text-3xl font-bold text-[#1E293B]">
                  {hud.hanzi}
                </span>
                <button
                  type="button"
                  onClick={() => speakChinese(hud.hanzi, speechRate)}
                  className="btn-tactile w-10 h-10 rounded-xl bg-[#F0FDFA] border border-[#0F766E]/25 text-[#0F766E] flex items-center justify-center cursor-pointer"
                  aria-label="Nghe lại từ"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <span className="text-sm font-semibold text-slate-600">
                Vượt qua 10 cổng để cán đích!
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F766E] bg-[#F0FDFA] px-2.5 py-1 rounded-lg border border-[#0F766E]/20">
            <Flag className="w-3.5 h-3.5" />
            <span>
              {hud.progress}/{TOTAL_GATES}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-semibold">{hud.score} điểm</p>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200/90 bg-[#1E293B]">
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerUp={handleCanvasPointerUp}
          className="w-full aspect-[480/540] block touch-none select-none cursor-pointer"
        />

        {/* Ready Overlay */}
        {phase === 'ready' && (
          <div className="absolute inset-0 bg-[#1E293B]/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white">
            <h2 className="text-xl font-bold">Sẵn sàng xuất phát?</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-xs leading-relaxed">
              Dùng phím <strong>← / →</strong>, <strong>A / D</strong> hoặc chạm trực tiếp vào làn đường để đâm xuyên cổng đáp án đúng.
            </p>

            <div className="flex items-center gap-2 mt-4 bg-white/10 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAnswerType('meaning')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  answerType === 'meaning' ? 'bg-[#0F766E] text-white' : 'text-slate-200'
                }`}
              >
                Đáp án Nghĩa Việt
              </button>
              <button
                type="button"
                onClick={() => setAnswerType('pinyin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  answerType === 'pinyin' ? 'bg-[#0F766E] text-white' : 'text-slate-200'
                }`}
              >
                Đáp án Pinyin
              </button>
            </div>

            <button
              id="racer-start-btn"
              type="button"
              onClick={startGame}
              className="btn-tactile mt-5 inline-flex items-center gap-2 min-h-[48px] px-7 rounded-xl bg-[#0F766E] hover:bg-[#14B8A6] text-white text-sm font-bold cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Bắt đầu đua</span>
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {phase === 'gameover' && failInfo && (
          <div className="absolute inset-0 bg-[#1E293B]/88 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="w-12 h-12 rounded-2xl bg-[#C2410C]/20 text-orange-300 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-orange-200">Game Over!</h2>
            <p className="text-xs text-slate-300 mt-1">
              Bạn đã vượt qua {failInfo.progress}/{TOTAL_GATES} cổng • {failInfo.score} điểm
            </p>

            <div className="mt-4 w-full max-w-xs rounded-xl bg-white/10 border border-white/15 p-4 text-left space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-slate-300">Đáp án đúng</p>
              <p className="font-hanzi-serif text-2xl font-bold text-white">
                {failInfo.word.hanzi}{' '}
                <span className="text-sm font-sans font-medium text-teal-300">
                  ({failInfo.word.pinyin})
                </span>
              </p>
              <p className="text-sm text-teal-200 font-semibold">{failInfo.word.meaning}</p>
            </div>

            <button
              type="button"
              onClick={startGame}
              className="btn-tactile mt-5 inline-flex items-center gap-2 min-h-[46px] px-6 rounded-xl bg-[#0F766E] hover:bg-[#14B8A6] text-white text-sm font-semibold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Chơi lại</span>
            </button>
          </div>
        )}

        {/* Victory Overlay */}
        {phase === 'victory' && (
          <div className="absolute inset-0 bg-[#0F766E]/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-3">
              <Trophy className="w-8 h-8 text-amber-300" />
            </div>
            <h2 className="text-2xl font-bold">Cán vạch Về đích!</h2>
            <p className="text-sm text-teal-100 mt-1">
              Hoàn thành 10/10 cổng trong <strong>{(hud.elapsedMs / 1000).toFixed(1)} giây</strong> •{' '}
              <strong>{hud.score} điểm</strong>
            </p>
            <button
              type="button"
              onClick={startGame}
              className="btn-tactile mt-5 inline-flex items-center gap-2 min-h-[46px] px-6 rounded-xl bg-white text-[#0F766E] text-sm font-bold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Phá kỷ lục mới</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile Touch Steering Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setLane(0)}
          className={`btn-tactile min-h-[48px] rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
            hud.lane === 0
              ? 'bg-[#F0FDFA] border-[#0F766E] text-[#0F766E]'
              : 'bg-white border-slate-200/90 text-slate-600'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Làn Trái</span>
        </button>
        <button
          type="button"
          onClick={() => setLane(1)}
          className={`btn-tactile min-h-[48px] rounded-xl border text-xs font-semibold cursor-pointer ${
            hud.lane === 1
              ? 'bg-[#F0FDFA] border-[#0F766E] text-[#0F766E]'
              : 'bg-white border-slate-200/90 text-slate-600'
          }`}
        >
          Làn Giữa
        </button>
        <button
          type="button"
          onClick={() => setLane(2)}
          className={`btn-tactile min-h-[48px] rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer ${
            hud.lane === 2
              ? 'bg-[#F0FDFA] border-[#0F766E] text-[#0F766E]'
              : 'bg-white border-slate-200/90 text-slate-600'
          }`}
        >
          <span>Làn Phải</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

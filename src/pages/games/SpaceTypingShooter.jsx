import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Flame, Play, RotateCcw, Send, Trophy } from 'lucide-react';
import { db } from '../../db/database';
import { useApp } from '../../context/AppContext';
import { matchPinyinInput, stripPinyinTones } from '../../utils/pinyin';
import { speakChinese } from '../../utils/speech';

const W = 560;
const H = 440;

export function SpaceTypingShooter() {
  const { activeProfileId, targetLevels, speechRate, recordStudyActivity } = useApp();

  const [phase, setPhase] = useState('ready'); // ready | playing | gameover
  const [typed, setTyped] = useState('');
  const [hud, setHud] = useState({ score: 0, lives: 3, combo: 0, destroyed: 0 });
  const [missedWords, setMissedWords] = useState([]);

  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const poolRef = useRef([]);
  const stateRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    db.vocab
      .where('level')
      .anyOf(targetLevels)
      .toArray()
      .then((list) => {
        poolRef.current = list;
      });
  }, [targetLevels.join(',')]);

  const spawnMeteor = useCallback((st) => {
    const pool = poolRef.current;
    if (!pool.length) return;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const margin = 70;
    const x = margin + Math.random() * (W - margin * 2);
    const speed = 34 + Math.min(68, st.destroyed * 2.2) + Math.random() * 14;
    st.meteors.push({
      id: Math.random(),
      word,
      x,
      y: -36,
      speed,
      radius: 34,
    });
  }, []);

  const startGame = useCallback(async () => {
    if (!poolRef.current.length) {
      poolRef.current = await db.vocab.where('level').anyOf(targetLevels).toArray();
    }
    if (!poolRef.current.length) return;
    const now = performance.now();
    const stars = Array.from({ length: 42 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.8 + Math.random() * 1.4,
      a: 0.25 + Math.random() * 0.55,
    }));

    stateRef.current = {
      phase: 'playing',
      lastTime: now,
      spawnTimer: 0,
      meteors: [],
      lasers: [],
      particles: [],
      stars,
      score: 0,
      lives: 3,
      combo: 0,
      destroyed: 0,
      missed: [],
    };
    spawnMeteor(stateRef.current);

    setTyped('');
    setMissedWords([]);
    setHud({ score: 0, lives: 3, combo: 0, destroyed: 0 });
    setPhase('playing');
    setTimeout(() => inputRef.current?.focus(), 60);
  }, [spawnMeteor, targetLevels]);

  const fireShot = useCallback(
    (rawInput) => {
      const st = stateRef.current;
      if (!st || st.phase !== 'playing') return;
      const attempt = rawInput.trim();
      if (!attempt) return;

      // Find lowest matching meteor (highest threat first)
      const matching = st.meteors
        .filter((m) => matchPinyinInput(attempt, m.word.pinyin))
        .sort((a, b) => b.y - a.y);

      if (matching.length > 0) {
        const target = matching[0];
        st.meteors = st.meteors.filter((m) => m.id !== target.id);
        st.combo += 1;
        st.destroyed += 1;
        st.score += 100 + Math.min(200, (st.combo - 1) * 25);

        st.lasers.push({
          x1: W / 2,
          y1: H - 46,
          x2: target.x,
          y2: target.y,
          life: 0.22,
        });

        for (let i = 0; i < 16; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 70 + Math.random() * 130;
          st.particles.push({
            x: target.x,
            y: target.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            life: 0.45,
            color: i % 2 === 0 ? '#14B8A6' : '#FDBA74',
          });
        }

        speakChinese(target.word.hanzi, speechRate);
        setHud({
          score: st.score,
          lives: st.lives,
          combo: st.combo,
          destroyed: st.destroyed,
        });
      } else {
        st.combo = 0;
        setHud((h) => ({ ...h, combo: 0 }));
      }
      setTyped('');
    },
    [speechRate]
  );

  // 60fps Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const loop = (now) => {
      const st = stateRef.current;

      if (st && st.phase === 'playing') {
        const dt = Math.min(0.05, (now - st.lastTime) / 1000);
        st.lastTime = now;

        const spawnInterval = Math.max(1.35, 3.0 - st.destroyed * 0.05);
        st.spawnTimer += dt;
        if (st.spawnTimer >= spawnInterval && st.meteors.length < 5) {
          st.spawnTimer = 0;
          spawnMeteor(st);
        }

        // Update meteors
        const remaining = [];
        for (const m of st.meteors) {
          m.y += m.speed * dt;
          if (m.y >= H - 48) {
            st.lives -= 1;
            st.combo = 0;
            st.missed.push(m.word);
            setMissedWords([...st.missed]);
            setHud({
              score: st.score,
              lives: st.lives,
              combo: 0,
              destroyed: st.destroyed,
            });
            if (st.lives <= 0) {
              st.phase = 'gameover';
              setPhase('gameover');
              recordStudyActivity();
              db.gameScores.add({
                profileId: activeProfileId,
                game: 'shooter',
                levelKey: targetLevels.join(','),
                score: st.score,
                timeMs: 0,
                createdAt: Date.now(),
              });
            }
          } else {
            remaining.push(m);
          }
        }
        st.meteors = remaining;

        st.lasers = st.lasers.filter((l) => {
          l.life -= dt;
          return l.life > 0;
        });

        st.particles = st.particles.filter((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          return p.life > 0;
        });
      }

      // Draw deep slate ink sky
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, W, H);

      // Stars
      if (st?.stars) {
        st.stars.forEach((s) => {
          ctx.fillStyle = `rgba(248, 250, 252, ${s.a})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Defense line
      ctx.strokeStyle = 'rgba(194, 65, 12, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, H - 50);
      ctx.lineTo(W, H - 50);
      ctx.stroke();
      ctx.setLineDash([]);

      // Lasers
      if (st?.lasers) {
        st.lasers.forEach((l) => {
          ctx.strokeStyle = '#2DD4BF';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(l.x1, l.y1);
          ctx.lineTo(l.x2, l.y2);
          ctx.stroke();

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(l.x1, l.y1);
          ctx.lineTo(l.x2, l.y2);
          ctx.stroke();
        });
      }

      // Meteors
      if (st?.meteors) {
        st.meteors.forEach((m) => {
          const danger = m.y > H * 0.65;
          ctx.fillStyle = danger ? 'rgba(194, 65, 12, 0.25)' : 'rgba(15, 118, 110, 0.22)';
          ctx.strokeStyle = danger ? '#FB923C' : '#2DD4BF';
          ctx.lineWidth = 1.8;

          const boxW = Math.max(106, m.word.hanzi.length * 26 + 34);
          const boxH = 58;
          ctx.beginPath();
          ctx.roundRect(m.x - boxW / 2, m.y - boxH / 2, boxW, boxH, 14);
          ctx.fill();
          ctx.stroke();

          // Hanzi
          ctx.fillStyle = '#FAF9F6';
          ctx.font = '600 22px "Noto Sans SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(m.word.hanzi, m.x, m.y - 8);

          // Small Vietnamese meaning hint
          ctx.fillStyle = '#CBD5E1';
          ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
          const shortMeaning =
            m.word.meaning.length > 18 ? m.word.meaning.slice(0, 17) + '…' : m.word.meaning;
          ctx.fillText(shortMeaning, m.x, m.y + 15);
        });
      }

      // Particles
      if (st?.particles) {
        st.particles.forEach((p) => {
          ctx.globalAlpha = Math.max(0, p.life * 2.2);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      // Spacecraft at bottom center
      ctx.save();
      ctx.translate(W / 2, H - 24);
      ctx.fillStyle = '#0F766E';
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(20, 14);
      ctx.lineTo(0, 6);
      ctx.lineTo(-20, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5EEAD4';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeProfileId, recordStudyActivity, spawnMeteor, targetLevels]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Allow multi-syllable space typing ONLY if no match yet, or fire immediately if matches!
      if (e.key === 'Enter') {
        e.preventDefault();
        fireShot(typed);
      } else if (e.key === ' ') {
        const st = stateRef.current;
        const hasMatch = st?.meteors?.some((m) => matchPinyinInput(typed, m.word.pinyin));
        if (hasMatch) {
          e.preventDefault();
          fireShot(typed);
        }
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* HUD */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Máy Bay Bắn Chữ • Pinyin không dấu
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xl font-bold text-[#1E293B]">{hud.score} điểm</span>
            {hud.combo > 1 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFF7ED] text-[#C2410C] text-xs font-bold">
                <Flame className="w-3.5 h-3.5" />
                x{hud.combo}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <Heart
              key={i}
              className={`w-5 h-5 ${
                i < hud.lives ? 'text-[#C2410C] fill-[#C2410C]' : 'text-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200/90 bg-[#0F172A]">
        <canvas ref={canvasRef} className="w-full aspect-[560/440] block" />

        {phase === 'ready' && (
          <div className="absolute inset-0 bg-[#0F172A]/82 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white">
            <h2 className="text-xl font-bold">Bảo vệ Trạm Vũ trụ HSK</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-sm leading-relaxed">
              Gõ nhanh <strong>Pinyin không dấu</strong> (viết liền như <code className="text-teal-300">aihao</code> hoặc có cách <code className="text-teal-300">ai hao</code>) rồi nhấn <strong>Enter / Space</strong> để bắn tia laser.
            </p>
            <button
              id="shooter-start-btn"
              type="button"
              onClick={startGame}
              className="btn-tactile mt-5 inline-flex items-center gap-2 min-h-[48px] px-7 rounded-xl bg-[#0F766E] hover:bg-[#14B8A6] text-white text-sm font-bold cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Cất cánh ngay</span>
            </button>
          </div>
        )}

        {phase === 'gameover' && (
          <div className="absolute inset-0 bg-[#0F172A]/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white overflow-y-auto">
            <Trophy className="w-10 h-10 text-amber-300 mb-2" />
            <h2 className="text-xl font-bold">Kết thúc lượt bay!</h2>
            <p className="text-sm text-teal-200 mt-1">
              Tổng điểm: <strong>{hud.score}</strong> • Đã bắn hạ <strong>{hud.destroyed}</strong> từ
            </p>

            {missedWords.length > 0 && (
              <div className="mt-4 w-full max-w-sm rounded-xl bg-white/10 border border-white/15 p-3 text-left space-y-1.5">
                <p className="text-[11px] uppercase tracking-wider text-slate-300">Từ bỏ lỡ cần ôn:</p>
                {missedWords.slice(0, 3).map((w, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-hanzi text-base text-white">{w.hanzi}</span>
                    <span className="text-teal-300 font-semibold">
                      {w.pinyin} ({stripPinyinTones(w.pinyin).replace(/\s+/g, '')})
                    </span>
                    <span className="text-slate-300 truncate max-w-[120px]">{w.meaning}</span>
                  </div>
                ))}
              </div>
            )}

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
      </div>

      {/* Typing Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          fireShot(typed);
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          disabled={phase !== 'playing'}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={
            phase === 'playing'
              ? 'Gõ Pinyin không dấu (vd: aihao) + Enter/Space để bắn...'
              : 'Nhấn Cất cánh để bắt đầu...'
          }
          className="flex-1 min-h-[48px] px-4 rounded-xl bg-white border border-slate-200/90 focus:border-[#0F766E] focus:outline-none text-sm font-medium text-[#1E293B]"
        />
        <button
          type="submit"
          disabled={phase !== 'playing'}
          className="btn-tactile min-h-[48px] px-5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>Bắn</span>
        </button>
      </form>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { THEMES, DIFFICULTY, buildDeck, shuffle, fmtTime, calcStars, Storage, AudioMgr, type ThemeKey, type Difficulty, type Card } from "./memory";

interface Props {
  theme: ThemeKey;
  difficulty: Difficulty;
  audio: AudioMgr;
  vibrate: boolean;
  daily?: boolean;
  onExit: () => void;
  onWin: (data: { time: number; moves: number; stars: number; combo: number; isBestTime: boolean; newlyUnlocked: string[]; daily?: boolean; dailyBestTime?: number; dailyBestMoves?: number }) => void;
}

export function GameBoard({ theme, difficulty, audio, vibrate, daily, onExit, onWin }: Props) {
  const cfg = DIFFICULTY[difficulty];
  const [cards, setCards] = useState<Card[]>(() => buildDeck(theme, difficulty));
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [comboPop, setComboPop] = useState<string | null>(null);
  const [hintIds, setHintIds] = useState<number[]>([]);
  const [freezeUntil, setFreezeUntil] = useState(0);
  const [powerups, setPowerups] = useState({ hint: 2, freeze: 1, shuffle: 1 });
  const [shake, setShake] = useState<number[]>([]);
  const lastMatchTs = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  const matchedCount = cards.filter(c => c.matched).length;
  const progress = (matchedCount / cards.length) * 100;

  // Timer
  useEffect(() => {
    if (!running || paused) return;
    const id = window.setInterval(() => {
      if (Date.now() < freezeUntil) return;
      setTime(t => t + 1);
    }, 1000);
    tickRef.current = id;
    return () => clearInterval(id);
  }, [running, paused, freezeUntil]);

  // Win
  useEffect(() => {
    if (cards.length && matchedCount === cards.length) {
      setRunning(false);
      const stars = calcStars(time, moves, cards.length / 2);
      const { isBestTime, newlyUnlocked } = Storage.addRecord(theme, difficulty, { time, moves, date: Date.now() });
      let dailyBestTime: number | undefined;
      let dailyBestMoves: number | undefined;
      if (daily) {
        const d = Storage.recordDaily(time, moves);
        dailyBestTime = d.bestTime; dailyBestMoves = d.bestMoves;
      }
      audio.win();
      setTimeout(() => onWin({ time, moves, stars, combo: bestCombo, isBestTime, newlyUnlocked, daily, dailyBestTime, dailyBestMoves }), 600);
    }
  }, [matchedCount]);

  function buzz(ms = 30) { if (vibrate && navigator.vibrate) navigator.vibrate(ms); }

  function flipCard(idx: number) {
    if (paused) return;
    if (selected.length >= 2) return;
    if (cards[idx].flipped || cards[idx].matched) return;
    if (!running) setRunning(true);
    audio.flip();
    buzz(15);
    const next = cards.slice();
    next[idx] = { ...next[idx], flipped: true };
    setCards(next);
    const newSel = [...selected, idx];
    setSelected(newSel);
    if (newSel.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = newSel;
      if (next[a].symbol === next[b].symbol) {
        setTimeout(() => {
          setCards(curr => {
            const u = curr.slice();
            u[a] = { ...u[a], matched: true };
            u[b] = { ...u[b], matched: true };
            return u;
          });
          const now = Date.now();
          const fast = now - lastMatchTs.current < 3500;
          lastMatchTs.current = now;
          const newCombo = fast ? combo + 1 : 1;
          setCombo(newCombo);
          setBestCombo(c => Math.max(c, newCombo));
          if (newCombo >= 2) {
            setComboPop(`COMBO x${newCombo}!`);
            audio.combo(newCombo);
            buzz(40);
            setTimeout(() => setComboPop(null), 950);
          } else {
            audio.match();
          }
          setSelected([]);
        }, 380);
      } else {
        audio.miss();
        buzz(50);
        // Wait for the second card's flip to fully reveal before shaking
        setTimeout(() => setShake([a, b]), 600);
        setTimeout(() => {
          setCards(curr => {
            const u = curr.slice();
            u[a] = { ...u[a], flipped: false };
            u[b] = { ...u[b], flipped: false };
            return u;
          });
          setShake([]);
          setSelected([]);
          setCombo(0);
        }, 1150);
      }
    }
  }

  // Power-ups
  function useHint() {
    if (powerups.hint <= 0) return;
    const unmatched = cards.filter(c => !c.matched);
    const groups: Record<string, number[]> = {};
    cards.forEach((c, i) => { if (!c.matched) (groups[c.symbol] ??= []).push(i); });
    const pair = Object.values(groups).find(g => g.length === 2);
    if (!pair) return;
    setPowerups(p => ({ ...p, hint: p.hint - 1 }));
    setHintIds(pair);
    setTimeout(() => setHintIds([]), 1200);
  }
  function useFreeze() {
    if (powerups.freeze <= 0) return;
    setPowerups(p => ({ ...p, freeze: p.freeze - 1 }));
    setFreezeUntil(Date.now() + 5000);
  }
  function useShuffle() {
    if (powerups.shuffle <= 0) return;
    setPowerups(p => ({ ...p, shuffle: p.shuffle - 1 }));
    setCards(curr => {
      const matched = curr.filter(c => c.matched);
      const rest = shuffle(curr.filter(c => !c.matched).map(c => ({ ...c, flipped: false })));
      // preserve grid order: rebuild by replacing non-matched slots
      const out: Card[] = [];
      let ri = 0;
      curr.forEach(c => out.push(c.matched ? c : rest[ri++]));
      return out;
    });
    setSelected([]);
  }

  return (
    <div className="min-h-screen flex flex-col p-4 sm:p-6 max-w-5xl mx-auto w-full fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <button onClick={onExit} className="ghost-btn !py-2 !px-3 text-sm">← Menu</button>
        <div className="flex gap-2 flex-wrap">
          <span className="chip">⏱ {fmtTime(time)} {Date.now() < freezeUntil && "❄️"}</span>
          <span className="chip">🎯 {moves}</span>
          <span className="chip">🔥 {combo}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPaused(p => !p)} className="ghost-btn !py-2 !px-3 text-sm" aria-label="Pause">
            {paused ? "▶" : "⏸"}
          </button>
          <button onClick={() => { setCards(buildDeck(theme, difficulty)); setMoves(0); setTime(0); setRunning(false); setSelected([]); setCombo(0); }} className="ghost-btn !py-2 !px-3 text-sm" aria-label="Restart">↻</button>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-bar mb-4"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>

      {/* Board */}
      <div
        className="card-grid"
        style={{
          gridTemplateColumns: `repeat(${cfg.cols}, 1fr)`,
          maxWidth: difficulty === "hard" ? "min(100%, 520px)" : "min(100%, 560px)",
        }}
      >
        {cards.map((c, i) => (
          <div
            key={c.id}
            className={[
              "mcard",
              c.flipped || c.matched ? "flipped" : "",
              c.matched ? "matched" : "",
              shake.includes(i) ? "shake" : "",
              hintIds.includes(i) ? "hint" : "",
            ].join(" ")}
            onClick={() => flipCard(i)}
            role="button"
            tabIndex={0}
            aria-label={c.flipped || c.matched ? `Card ${c.symbol}` : "Hidden card"}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipCard(i); } }}
          >
            <div className="mcard-inner">
              <div className="mcard-face mcard-back" />
              <div className="mcard-face mcard-front">{c.symbol}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Power-ups */}
      <div className="flex justify-center gap-3 mt-6 flex-wrap">
        <button onClick={useHint} disabled={powerups.hint <= 0} className="neon-btn !py-2 !px-4 text-sm">💡 Hint <span className="opacity-70">×{powerups.hint}</span></button>
        <button onClick={useFreeze} disabled={powerups.freeze <= 0} className="neon-btn !py-2 !px-4 text-sm">❄️ Freeze <span className="opacity-70">×{powerups.freeze}</span></button>
        <button onClick={useShuffle} disabled={powerups.shuffle <= 0} className="neon-btn !py-2 !px-4 text-sm">🔀 Shuffle <span className="opacity-70">×{powerups.shuffle}</span></button>
      </div>

      {comboPop && <div className="combo-pop">{comboPop}</div>}

      {paused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-md fade-in" onClick={() => setPaused(false)}>
          <div className="glass-strong rounded-3xl p-8 text-center scale-in">
            <h2 className="text-3xl font-bold mb-2 neon-text">Paused</h2>
            <p className="text-sm opacity-70 mb-4">Tap anywhere to resume</p>
          </div>
        </div>
      )}
    </div>
  );
}

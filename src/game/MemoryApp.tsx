import { useEffect, useMemo, useState } from "react";
import { THEMES, DIFFICULTY, fmtTime, Storage, AudioMgr, isThemeUnlocked, type ThemeKey, type Difficulty } from "./memory";
import { GameBoard } from "./GameBoard";

type Screen = "menu" | "game" | "win" | "leaderboard" | "settings";

const audio = new AudioMgr();

export function MemoryApp() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [store, setStore] = useState(() => Storage.load());
  const [theme, setTheme] = useState<ThemeKey>("animals");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [winData, setWinData] = useState<any>(null);
  const [gameKey, setGameKey] = useState(0);
  const [isDaily, setIsDaily] = useState(false);

  // Apply theme + settings
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("light", store.settings.light);
    document.documentElement.classList.toggle("reduced-motion", store.settings.reducedMotion);
    audio.enabled = store.settings.sound;
  }, [theme, store]);

  function updateSettings(patch: Partial<typeof store.settings>) {
    const next = { ...store, settings: { ...store.settings, ...patch } };
    setStore(next); Storage.save(next);
  }

  function startGame(t: ThemeKey, d: Difficulty, daily = false) {
    setTheme(t); setDifficulty(d); setIsDaily(daily); setGameKey(k => k + 1); setScreen("game");
  }

  function startDaily() {
    const d = Storage.getDaily();
    startGame(d.theme, d.difficulty, true);
  }

  function randomChallenge() {
    const themes = (Object.keys(THEMES) as ThemeKey[]).filter(t => isThemeUnlocked(t, store.totalWins));
    const diffs: Difficulty[] = ["easy", "medium", "hard"];
    startGame(themes[Math.floor(Math.random() * themes.length)], diffs[Math.floor(Math.random() * diffs.length)]);
  }

  return (
    <div className="relative min-h-screen">
      <Particles />
      {screen === "menu" && (
        <Menu
          theme={theme} difficulty={difficulty}
          setTheme={setTheme} setDifficulty={setDifficulty}
          totalWins={store.totalWins}
          onStart={() => startGame(theme, difficulty)}
          onRandom={randomChallenge}
          onDaily={startDaily}
          onLeaderboard={() => setScreen("leaderboard")}
          onSettings={() => setScreen("settings")}
        />
      )}
      {screen === "game" && (
        <GameBoard
          key={gameKey}
          theme={theme} difficulty={difficulty}
          daily={isDaily}
          audio={audio} vibrate={store.settings.vibrate}
          onExit={() => setScreen("menu")}
          onWin={(d) => { setWinData(d); setStore(Storage.load()); setScreen("win"); }}
        />
      )}
      {screen === "win" && winData && (
        <WinScreen
          data={winData} theme={theme} difficulty={difficulty}
          onReplay={() => { setGameKey(k => k + 1); setScreen("game"); }}
          onMenu={() => setScreen("menu")}
          onNext={isDaily ? startDaily : randomChallenge}
        />
      )}
      {screen === "leaderboard" && (
        <Leaderboard theme={theme} difficulty={difficulty} setTheme={setTheme} setDifficulty={setDifficulty} onBack={() => setScreen("menu")} />
      )}
      {screen === "settings" && (
        <Settings settings={store.settings} update={updateSettings} onBack={() => setScreen("menu")} />
      )}
    </div>
  );
}

function Particles() {
  const items = useMemo(() =>
    Array.from({ length: 24 }).map(() => ({
      left: Math.random() * 100,
      size: 4 + Math.random() * 10,
      dur: 14 + Math.random() * 16,
      delay: Math.random() * -20,
    })), []);
  return (
    <div className="particles" aria-hidden>
      {items.map((p, i) => (
        <span key={i} className="particle" style={{
          left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`,
          animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
        }} />
      ))}
    </div>
  );
}

function Menu(props: {
  theme: ThemeKey; difficulty: Difficulty;
  setTheme: (t: ThemeKey) => void; setDifficulty: (d: Difficulty) => void;
  totalWins: number;
  onStart: () => void; onRandom: () => void; onDaily: () => void; onLeaderboard: () => void; onSettings: () => void;
}) {
  const daily = useMemo(() => Storage.getDaily(), [props.totalWins]);
  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6 fade-in">
      <div className="text-center mb-8">
        <div className="text-6xl mb-2">{THEMES[props.theme].emoji}</div>
        <h1 className="title-glow">Prism Match</h1>
        <p className="opacity-70 mt-2 text-sm sm:text-base">Flip. Match. Beat your best.</p>
      </div>

      <button onClick={props.onDaily} className="daily-card scale-in w-full max-w-md mb-4 text-left">
        <div className="daily-shine" />
        <div className="flex items-center justify-between gap-3 relative">
          <div className="flex items-center gap-3">
            <div className="daily-emoji">{THEMES[daily.theme].emoji}</div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] opacity-80 flex items-center gap-2">
                <span className="daily-dot" /> Daily Challenge
              </div>
              <div className="font-bold text-base leading-tight">{THEMES[daily.theme].name} · {DIFFICULTY[daily.difficulty].label}</div>
              <div className="text-[11px] opacity-70 mt-0.5">
                {daily.completed
                  ? <>Best <b>{fmtTime(daily.bestTime!)}</b> · {daily.bestMoves} moves · {daily.plays} plays</>
                  : <>New challenge available today</>}
              </div>
            </div>
          </div>
          <span className="daily-go">▶</span>
        </div>
      </button>

      <div className="glass-strong rounded-3xl p-6 w-full max-w-md scale-in">
        <div className="mb-5">
          <h3 className="text-xs uppercase tracking-widest opacity-60 mb-2">Theme</h3>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(THEMES) as ThemeKey[]).map(t => {
              const unlocked = isThemeUnlocked(t, props.totalWins);
              const remaining = THEMES[t].unlockWins - props.totalWins;
              return (
                <button
                  key={t}
                  className={`sel-chip relative ${props.theme === t ? "active" : ""} ${!unlocked ? "locked" : ""}`}
                  onClick={() => unlocked && props.setTheme(t)}
                  aria-label={unlocked ? THEMES[t].name : `${THEMES[t].name} locked`}
                  title={unlocked ? THEMES[t].name : `🔒 ${THEMES[t].unlockHint}`}
                >
                  <span className="text-2xl">{unlocked ? THEMES[t].emoji : "🔒"}</span>
                  <span className="text-[10px] opacity-80">{unlocked ? THEMES[t].name : `${remaining} wins`}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mb-6">
          <h3 className="text-xs uppercase tracking-widest opacity-60 mb-2">Difficulty</h3>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DIFFICULTY) as Difficulty[]).map(d => (
              <button key={d} className={`sel-chip ${props.difficulty === d ? "active" : ""}`} onClick={() => props.setDifficulty(d)}>
                <span className="font-semibold">{DIFFICULTY[d].label}</span>
                <span className="text-[10px] opacity-70">{DIFFICULTY[d].pairs * 2} cards</span>
              </button>
            ))}
          </div>
        </div>

        <button onClick={props.onStart} className="neon-btn w-full text-lg mb-2">▶ Start Game</button>
        <button onClick={props.onRandom} className="ghost-btn w-full mb-2">🎲 Random Challenge</button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={props.onLeaderboard} className="ghost-btn">🏆 Leaderboard</button>
          <button onClick={props.onSettings} className="ghost-btn">⚙ Settings</button>
        </div>
        {props.totalWins > 0 && (
          <p className="text-center text-xs opacity-50 mt-4">Total wins: {props.totalWins}</p>
        )}
      </div>
    </div>
  );
}

function WinScreen({ data, theme, difficulty, onReplay, onMenu, onNext }: any) {
  const best = Storage.getBoard(theme, difficulty)[0];
  const unlocked: ThemeKey[] = data.newlyUnlocked ?? [];
  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
      <Confetti />
      <div className="glass-strong rounded-3xl p-7 max-w-md w-full text-center scale-in win-card">
        <div className="win-emoji">{THEMES[theme as ThemeKey].emoji}</div>
        <h2 className="title-glow !text-4xl mb-1">Victory!</h2>
        <p className="text-xs uppercase tracking-[0.3em] opacity-60 mb-3">{THEMES[theme as ThemeKey].name} · {DIFFICULTY[difficulty as Difficulty].label}</p>
        {data.daily && (
          <div className="best-banner mb-3" style={{ background: "linear-gradient(90deg, var(--theme-accent-2), var(--theme-accent))" }}>☀ DAILY CHALLENGE</div>
        )}
        {data.isBestTime && (
          <div className="best-banner mb-3">⭐ NEW BEST TIME ⭐</div>
        )}
        <div className="flex justify-center gap-3 my-4">
          {[1,2,3].map(n => (
            <span
              key={n}
              className={`star ${n > data.stars ? "dim" : "star-pop"}`}
              style={{ animationDelay: `${n * 0.18}s` }}
            >★</span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 my-5 text-left">
          <Stat label="Time" value={fmtTime(data.time)} />
          <Stat label="Moves" value={data.moves} />
          <Stat label="Best Combo" value={`x${data.combo}`} />
          <Stat label={data.daily ? "Today's Best" : "Best Time"} value={data.daily ? (data.dailyBestTime !== undefined ? fmtTime(data.dailyBestTime) : "—") : (best ? fmtTime(best.time) : "—")} />
          {data.daily && (
            <Stat label="Today's Best Moves" value={data.dailyBestMoves ?? "—"} />
          )}
        </div>
        {unlocked.length > 0 && (
          <div className="unlock-banner mb-4">
            <div className="text-xs uppercase tracking-widest opacity-80 mb-1">🎉 Theme Unlocked</div>
            <div className="flex justify-center gap-3 mt-2">
              {unlocked.map(t => (
                <div key={t} className="flex flex-col items-center">
                  <span className="text-3xl">{THEMES[t].emoji}</span>
                  <span className="text-[11px] font-semibold">{THEMES[t].name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={onReplay} className="neon-btn w-full mb-2">↻ Play Again</button>
        <button onClick={onNext} className="ghost-btn w-full mb-2">{data.daily ? "☀ Replay Daily" : "🎲 Next Challenge"}</button>
        <button onClick={onMenu} className="ghost-btn w-full">← Menu</button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="glass rounded-xl px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="font-bold text-lg">{value}</div>
    </div>
  );
}

function Confetti() {
  const colors = ["#d946ef","#06b6d4","#fbbf24","#34d399","#f472b6","#818cf8"];
  const items = useMemo(() => Array.from({ length: 80 }).map(() => ({
    left: Math.random() * 100,
    bg: colors[Math.floor(Math.random() * colors.length)],
    dur: 2.5 + Math.random() * 2.5,
    delay: Math.random() * 0.8,
    rot: Math.random() * 360,
  })), []);
  return (
    <div className="confetti">
      {items.map((c, i) => (
        <span key={i} style={{
          left: `${c.left}%`, background: c.bg,
          animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s`,
          transform: `rotate(${c.rot}deg)`,
        }} />
      ))}
    </div>
  );
}

function Leaderboard({ theme, difficulty, setTheme, setDifficulty, onBack }: any) {
  const board = Storage.getBoard(theme, difficulty);
  return (
    <div className="relative z-10 min-h-screen p-6 max-w-md mx-auto fade-in">
      <button onClick={onBack} className="ghost-btn mb-4">← Back</button>
      <h2 className="title-glow !text-3xl mb-4 text-center">🏆 Leaderboard</h2>
      <div className="glass-strong rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-5 gap-1 mb-3">
          {(Object.keys(THEMES) as ThemeKey[]).map(t => (
            <button key={t} className={`sel-chip !py-2 ${theme === t ? "active" : ""}`} onClick={() => setTheme(t)}>
              <span className="text-xl">{THEMES[t].emoji}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(DIFFICULTY) as Difficulty[]).map(d => (
            <button key={d} className={`sel-chip ${difficulty === d ? "active" : ""}`} onClick={() => setDifficulty(d)}>
              <span className="text-sm">{DIFFICULTY[d].label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="glass-strong rounded-2xl p-4">
        {board.length === 0 ? (
          <p className="text-center opacity-60 py-8">No records yet.<br/>Be the first!</p>
        ) : board.map((r, i) => (
          <div key={i} className={`flex items-center justify-between py-3 ${i < board.length - 1 ? "border-b border-white/10" : ""}`}>
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${i === 0 ? "neon-glow" : ""}`} style={{
                background: i === 0 ? "linear-gradient(135deg, #fbbf24, #f59e0b)" : i === 1 ? "linear-gradient(135deg, #d1d5db, #9ca3af)" : i === 2 ? "linear-gradient(135deg, #d97706, #92400e)" : "rgba(255,255,255,0.1)"
              }}>{i + 1}</span>
              <div>
                <div className="font-bold">{fmtTime(r.time)}</div>
                <div className="text-xs opacity-60">{r.moves} moves</div>
              </div>
            </div>
            <span className="text-xs opacity-50">{new Date(r.date).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings({ settings, update, onBack }: any) {
  const items: [string, string, string][] = [
    ["sound", "🔊", "Sound effects"],
    ["music", "🎵", "Background music"],
    ["light", "🌞", "Light mode"],
    ["vibrate", "📳", "Vibration"],
    ["reducedMotion", "♿", "Reduced motion"],
  ];
  return (
    <div className="relative z-10 min-h-screen p-6 max-w-md mx-auto fade-in">
      <button onClick={onBack} className="ghost-btn mb-4">← Back</button>
      <h2 className="title-glow !text-3xl mb-6 text-center">⚙ Settings</h2>
      <div className="glass-strong rounded-2xl p-2">
        {items.map(([key, icon, label]) => (
          <label key={key} className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 rounded-xl">
            <span className="flex items-center gap-3"><span className="text-xl">{icon}</span>{label}</span>
            <input
              type="checkbox" checked={!!settings[key]}
              onChange={(e) => update({ [key]: e.target.checked })}
              className="w-12 h-6 appearance-none rounded-full bg-white/10 relative cursor-pointer transition-colors checked:bg-[var(--theme-accent)] before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-6"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// Memory Match Game — core logic & managers
export type ThemeKey = "animals" | "space" | "fantasy" | "food" | "sports";
export type Difficulty = "easy" | "medium" | "hard";

export const THEMES: Record<ThemeKey, { name: string; emoji: string; symbols: string[]; unlockWins: number; unlockHint: string }> = {
  animals: {
    name: "Animals", emoji: "🦁", unlockWins: 0, unlockHint: "Starter theme",
    symbols: ["🦁","🐯","🐼","🦊","🐨","🐸","🐵","🦉","🦄","🐙","🦒","🦋","🐳","🦩","🐢","🐝","🦘","🦜"],
  },
  food: {
    name: "Food", emoji: "🍕", unlockWins: 2, unlockHint: "Win 2 games",
    symbols: ["🍕","🍔","🍟","🌮","🍩","🍦","🍓","🍣","🥑","🍉","🍪","🥐","🍰","🍇","🍑","🥨","🍿","🧁"],
  },
  sports: {
    name: "Sports", emoji: "⚽", unlockWins: 5, unlockHint: "Win 5 games",
    symbols: ["⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","⛳","🏒","🏏","🥋","🎯","🛹","🏆"],
  },
  space: {
    name: "Space", emoji: "🚀", unlockWins: 10, unlockHint: "Win 10 games",
    symbols: ["🚀","🛸","🌍","🌙","⭐","☄️","🪐","👽","🌌","☀️","🌠","🛰️","🌑","🌟","💫","🌞","🌗","🪨"],
  },
  fantasy: {
    name: "Fantasy", emoji: "🧙", unlockWins: 18, unlockHint: "Win 18 games",
    symbols: ["🧙","🐉","🗡️","🛡️","👑","🔮","🏰","🧚","🦅","⚔️","💎","🪄","📜","🧝","🐲","🌟","🗝️","🏹"],
  },
};

export function isThemeUnlocked(theme: ThemeKey, totalWins: number): boolean {
  return totalWins >= THEMES[theme].unlockWins;
}

export const DIFFICULTY: Record<Difficulty, { pairs: number; cols: number; rows: number; label: string }> = {
  easy:   { pairs: 6,  cols: 4, rows: 3, label: "Easy" },
  medium: { pairs: 10, cols: 5, rows: 4, label: "Medium" },
  hard:   { pairs: 18, cols: 6, rows: 6, label: "Hard" },
};

export interface Card {
  id: number;
  symbol: string;
  matched: boolean;
  flipped: boolean;
}

export function buildDeck(theme: ThemeKey, difficulty: Difficulty): Card[] {
  const { pairs } = DIFFICULTY[difficulty];
  const symbols = THEMES[theme].symbols.slice(0, pairs);
  const deck: Card[] = [];
  symbols.forEach((s, i) => {
    deck.push({ id: i * 2, symbol: s, matched: false, flipped: false });
    deck.push({ id: i * 2 + 1, symbol: s, matched: false, flipped: false });
  });
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function calcStars(time: number, moves: number, pairs: number): number {
  const idealMoves = pairs;
  const moveRatio = idealMoves / Math.max(moves, 1);
  const timeTarget = pairs * 4; // seconds
  const timeRatio = timeTarget / Math.max(time, 1);
  const score = (moveRatio + timeRatio) / 2;
  if (score > 0.85) return 3;
  if (score > 0.55) return 2;
  return 1;
}

// === Storage ===
export interface Record_ { time: number; moves: number; date: number; }
const KEY = "memory-match-v1";

export interface DailyState {
  date: string;
  theme: ThemeKey;
  difficulty: Difficulty;
  bestTime?: number;
  bestMoves?: number;
  plays: number;
  completed: boolean;
}

interface Store {
  leaderboards: Record<string, Record_[]>;
  unlocked: string[];
  settings: {
    sound: boolean; music: boolean; light: boolean; vibrate: boolean; reducedMotion: boolean;
  };
  totalWins: number;
  daily?: DailyState;
}

const defaultStore: Store = {
  leaderboards: {},
  unlocked: ["animals"],
  settings: { sound: true, music: false, light: false, vibrate: true, reducedMotion: false },
  totalWins: 0,
};

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Deterministic hash from a string
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function buildDaily(unlocked: ThemeKey[]): { theme: ThemeKey; difficulty: Difficulty; date: string } {
  const date = todayKey();
  const themes = unlocked.length ? unlocked : (["animals"] as ThemeKey[]);
  const diffs: Difficulty[] = ["easy", "medium", "hard"];
  const h = hashStr(date);
  const theme = themes[h % themes.length];
  const difficulty = diffs[(h >> 8) % diffs.length];
  return { theme, difficulty, date };
}

export const Storage = {
  load(): Store {
    if (typeof window === "undefined") return defaultStore;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultStore;
      return { ...defaultStore, ...JSON.parse(raw) };
    } catch { return defaultStore; }
  },
  save(s: Store) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  },
  key(theme: ThemeKey, diff: Difficulty) { return `${theme}-${diff}`; },
  addRecord(theme: ThemeKey, diff: Difficulty, rec: Record_): { isBestTime: boolean; newlyUnlocked: ThemeKey[] } {
    const s = this.load();
    const k = this.key(theme, diff);
    const list = s.leaderboards[k] ?? [];
    const prevBest = list[0]?.time ?? Infinity;
    list.push(rec);
    list.sort((a, b) => a.time - b.time || a.moves - b.moves);
    s.leaderboards[k] = list.slice(0, 5);
    s.totalWins += 1;
    const newlyUnlocked: ThemeKey[] = [];
    (Object.keys(THEMES) as ThemeKey[]).forEach(t => {
      if (!s.unlocked.includes(t) && s.totalWins >= THEMES[t].unlockWins) {
        s.unlocked.push(t);
        newlyUnlocked.push(t);
      }
    });
    this.save(s);
    return { isBestTime: rec.time < prevBest, newlyUnlocked };
  },
  getBoard(theme: ThemeKey, diff: Difficulty): Record_[] {
    return this.load().leaderboards[this.key(theme, diff)] ?? [];
  },
  getDaily(): DailyState {
    const s = this.load();
    const unlocked = (Object.keys(THEMES) as ThemeKey[]).filter(t => isThemeUnlocked(t, s.totalWins));
    const { theme, difficulty, date } = buildDaily(unlocked);
    if (!s.daily || s.daily.date !== date) {
      const fresh: DailyState = { date, theme, difficulty, plays: 0, completed: false };
      s.daily = fresh;
      this.save(s);
      return fresh;
    }
    return s.daily;
  },
  recordDaily(time: number, moves: number): DailyState {
    const s = this.load();
    const cur = this.getDaily();
    const next: DailyState = {
      ...cur,
      plays: cur.plays + 1,
      completed: true,
      bestTime: cur.bestTime === undefined ? time : Math.min(cur.bestTime, time),
      bestMoves: cur.bestMoves === undefined ? moves : Math.min(cur.bestMoves, moves),
    };
    s.daily = next;
    this.save(s);
    return next;
  },
};

// === Audio ===
export class AudioMgr {
  ctx: AudioContext | null = null;
  enabled = true;
  private ensure() {
    if (!this.ctx && typeof window !== "undefined") {
      try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch {}
    }
  }
  beep(freq: number, dur = 0.12, type: OscillatorType = "sine", vol = 0.15) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  flip() { this.beep(420, 0.07, "triangle", 0.1); }
  match() { this.beep(660, 0.1, "sine", 0.15); setTimeout(() => this.beep(880, 0.12, "sine", 0.15), 70); }
  miss() { this.beep(180, 0.18, "sawtooth", 0.08); }
  combo(n: number) { this.beep(500 + n * 80, 0.15, "square", 0.12); }
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.beep(f, 0.18, "triangle", 0.18), i * 110));
  }
}

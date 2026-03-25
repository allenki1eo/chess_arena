// src/utils/playerDB.js
//
// Two-layer persistence system:
//   1. localStorage  — instant, always works, per-device
//   2. Supabase (via Vercel API routes) — shared global leaderboard, survives browser clears
//
// The game always reads from localStorage first for speed.
// Supabase syncs happen async in the background — game never waits for them.

const PROFILE_KEY = "ca_profile_v2";

// ─── Default profile shape ────────────────────────────────────────────────────
export function defaultProfile(username = "Player") {
  return {
    username,
    createdAt:        Date.now(),
    lastSeen:         Date.now(),

    // Scores & progression
    totalScore:       0,
    xp:               0,
    level:            1,

    // Match record
    totalGames:       0,
    totalWins:        0,
    totalLosses:      0,
    totalDraws:       0,
    bestStreak:       0,
    currentStreak:    0,
    lossStreak:       0,
    defeatedApex:     false,

    // Per-model stats
    modelStats: {},
    // shape: { [modelId]: { games, wins, losses, draws, highScore } }

    // Achievement IDs unlocked
    achievements:     [],

    // Recent games (last 20)
    recentGames:      [],
    // shape: [{ modelId, modelName, result, score, moves, seconds, date }]
  };
}

// ─── Load / Save profile ──────────────────────────────────────────────────────
export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    profile.lastSeen = Date.now();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.warn("Could not save profile:", err.message);
  }
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

// ─── Record a completed game ──────────────────────────────────────────────────
export function recordGame(profile, { modelId, modelName, result, score, moves, seconds }) {
  const updated = { ...profile };

  updated.totalGames++;
  updated.totalScore += score;
  updated.xp         += score;
  updated.lastSeen    = Date.now();

  if (result === "win") {
    updated.totalWins++;
    updated.currentStreak++;
    updated.lossStreak  = 0;
    updated.bestStreak  = Math.max(updated.bestStreak, updated.currentStreak);
  } else if (result === "lose") {
    updated.totalLosses++;
    updated.currentStreak = 0;
    updated.lossStreak++;
  } else {
    updated.totalDraws++;
    updated.currentStreak = 0;
  }

  // Per-model stats
  const ms = updated.modelStats[modelId] || { games:0, wins:0, losses:0, draws:0, highScore:0 };
  ms.games++;
  if (result === "win")  { ms.wins++;   ms.highScore = Math.max(ms.highScore, score); }
  if (result === "lose") ms.losses++;
  if (result === "draw") ms.draws++;
  updated.modelStats = { ...updated.modelStats, [modelId]: ms };

  // Recent games (keep last 20)
  updated.recentGames = [
    { modelId, modelName, result, score, moves, seconds, date: Date.now() },
    ...updated.recentGames,
  ].slice(0, 20);

  return updated;
}

// ─── Neon sync (async, never blocks game) ─────────────────────────────────────
export async function syncToSupabase(profile, gameData) {
  try {
    const payload = {
      username:     profile.username,
      score:        gameData.score     || 0,
      won:          gameData.result === "win",
      modelId:      gameData.modelId   || "",
      modelName:    gameData.modelName || "",
      streak:       profile.currentStreak || 0,   // FIX: use currentStreak not bestStreak
      level:        getProfileLevel(profile),
      defeatedApex: profile.defeatedApex || false,
      moves:        gameData.moves   || 0,
      seconds:      gameData.seconds || 0,         // FIX: was "duration", API expects "seconds"
    };

    const res = await fetch("/api/leaderboard-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn("Supabase sync failed:", res.status);
      return false;
    }

    const json = await res.json();
    if (json.saved === false) {
      console.warn("Supabase sync:", json.reason || json.error || "unknown");
    }
    return json.saved === true;
  } catch (err) {
    console.warn("Supabase sync error:", err.message);
    return false;
  }
}

// Helper — derive numeric level from XP
function getProfileLevel(profile) {
  const LEVELS = [0, 500, 1500, 3500, 7000, 15000, 30000, 60000];
  const xp = profile.xp || 0;
  let lvl = 1;
  for (let i = 0; i < LEVELS.length; i++) { if (xp >= LEVELS[i]) lvl = i + 1; }
  return lvl;
}

// Keep old name as alias for backwards compat
export const syncToNeon = syncToSupabase;

export async function fetchGlobalLeaderboard() {
  try {
    const res = await fetch("/api/leaderboard-get");
    if (!res.ok) return null;
    const json = await res.json();
    if (json.source === "none" || json.source === "error") return null;
    return json; // { players: [...], aiStats: [...] }
  } catch {
    return null;
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────
export function winRate(profile) {
  if (!profile.totalGames) return 0;
  return Math.round((profile.totalWins / profile.totalGames) * 100);
}

export function modelWinRate(profile, modelId) {
  const ms = profile.modelStats[modelId];
  if (!ms || !ms.games) return 0;
  return Math.round((ms.wins / ms.games) * 100);
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s/60)}m ${s%60}s`;
}

export function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

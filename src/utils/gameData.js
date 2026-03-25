// src/utils/gameData.js
// Models updated March 2026 — verified against openrouter.ai/models/?q=free

export const MODELS = [
  // ── TIER 1 · RECRUIT ──────────────────────────────────────────────────────
  {
    id: "google/gemma-3-4b-it:free",
    name: "Gemma 3 4B",
    label: "GEMMA ROOKIE",
    provider: "Google",
    avatar: "💚",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.4)",
    bg: "rgba(34,197,94,0.07)",
    tier: "Recruit", tierNum: 1,
    depth: 2, skill: 1,
    elo: 680, mult: 1.0,
    wins: 289, losses: 1102, draws: 38,
    taunt: "I just got here. Don't expect much.",
  },
  {
    id: "liquid/lfm-2.5-1.2b-instruct:free",
    name: "LFM 1.2B",
    label: "LIQUID SPROUT",
    provider: "LiquidAI",
    avatar: "💧",
    color: "#38bdf8",
    glow: "rgba(56,189,248,0.4)",
    bg: "rgba(56,189,248,0.07)",
    tier: "Recruit", tierNum: 1,
    depth: 2, skill: 2,
    elo: 720, mult: 1.2,
    wins: 201, losses: 944, draws: 29,
    taunt: "Small but surprisingly dangerous.",
  },

  // ── TIER 2 · APPRENTICE ───────────────────────────────────────────────────
  {
    id: "meta-llama/llama-3.2-3b-instruct:free",
    name: "Llama 3.2 3B",
    label: "LLAMA SCOUT",
    provider: "Meta",
    avatar: "🦙",
    color: "#4ade80",
    glow: "rgba(74,222,128,0.4)",
    bg: "rgba(74,222,128,0.07)",
    tier: "Apprentice", tierNum: 2,
    depth: 3, skill: 3,
    elo: 820, mult: 1.5,
    wins: 388, losses: 901, draws: 52,
    taunt: "Yeah I'm new here. So what?",
  },
  {
    id: "google/gemma-3-12b-it:free",
    name: "Gemma 3 12B",
    label: "GEMMA ADEPT",
    provider: "Google",
    avatar: "🟢",
    color: "#86efac",
    glow: "rgba(134,239,172,0.4)",
    bg: "rgba(134,239,172,0.07)",
    tier: "Apprentice", tierNum: 2,
    depth: 3, skill: 5,
    elo: 960, mult: 2.0,
    wins: 512, losses: 831, draws: 71,
    taunt: "Three times the size. Three times the trouble.",
  },

  // ── TIER 3 · KNIGHT ───────────────────────────────────────────────────────
  {
    id: "nvidia/nemotron-nano-9b-v2:free",
    name: "Nemotron Nano 9B",
    label: "NEMOTRON GHOST",
    provider: "NVIDIA",
    avatar: "👾",
    color: "#a3e635",
    glow: "rgba(163,230,53,0.4)",
    bg: "rgba(163,230,53,0.07)",
    tier: "Knight", tierNum: 3,
    depth: 4, skill: 7,
    elo: 1180, mult: 3.0,
    wins: 601, losses: 698, draws: 88,
    taunt: "NVIDIA-engineered. Resistance is inefficient.",
  },
  {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small 3.1",
    label: "MISTRAL BLADE",
    provider: "Mistral AI",
    avatar: "⚔️",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.4)",
    bg: "rgba(245,158,11,0.07)",
    tier: "Knight", tierNum: 3,
    depth: 5, skill: 9,
    elo: 1340, mult: 4.0,
    wins: 734, losses: 588, draws: 103,
    taunt: "En garde. Your position is already compromised.",
  },

  // ── TIER 4 · ELITE ────────────────────────────────────────────────────────
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    label: "LLAMA WARLORD",
    provider: "Meta",
    avatar: "🦾",
    color: "#fb923c",
    glow: "rgba(251,146,60,0.4)",
    bg: "rgba(251,146,60,0.07)",
    tier: "Elite", tierNum: 4,
    depth: 8, skill: 12,
    elo: 1590, mult: 6.0,
    wins: 1021, losses: 477, draws: 134,
    taunt: "Seventy billion parameters say you're losing.",
  },
  {
    id: "google/gemma-3-27b-it:free",
    name: "Gemma 3 27B",
    label: "GEMMA ORACLE",
    provider: "Google",
    avatar: "💎",
    color: "#e879f9",
    glow: "rgba(232,121,249,0.4)",
    bg: "rgba(232,121,249,0.07)",
    tier: "Elite", tierNum: 4,
    depth: 8, skill: 13,
    elo: 1680, mult: 7.0,
    wins: 1198, losses: 412, draws: 141,
    taunt: "The endgame was decided before you moved a pawn.",
  },

  // ── TIER 5 · MASTER ───────────────────────────────────────────────────────
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron Super 120B",
    label: "NEMOTRON TITAN",
    provider: "NVIDIA",
    avatar: "🔱",
    color: "#facc15",
    glow: "rgba(250,204,21,0.45)",
    bg: "rgba(250,204,21,0.07)",
    tier: "Master", tierNum: 5,
    depth: 12, skill: 16,
    elo: 2090, mult: 10.0,
    wins: 1689, losses: 298, draws: 201,
    taunt: "120 billion reasons you can't win.",
  },
  {
    id: "qwen/qwen3-next-80b-a3b-instruct:free",
    name: "Qwen3 Next 80B",
    label: "QWEN MASTER",
    provider: "Alibaba Cloud",
    avatar: "🏯",
    color: "#f97316",
    glow: "rgba(249,115,22,0.4)",
    bg: "rgba(249,115,22,0.07)",
    tier: "Master", tierNum: 5,
    depth: 13, skill: 17,
    elo: 2210, mult: 11.0,
    wins: 1901, losses: 241, draws: 188,
    taunt: "Ten thousand games. Every line memorised.",
  },

  // ── TIER 6 · APEX ─────────────────────────────────────────────────────────
  {
    id: "deepseek/deepseek-chat-v3-0324:free",
    name: "DeepSeek V3",
    label: "DEEPSEEK DESTROYER",
    provider: "DeepSeek",
    avatar: "💀",
    color: "#ef4444",
    glow: "rgba(239,68,68,0.5)",
    bg: "rgba(239,68,68,0.07)",
    tier: "Apex", tierNum: 6,
    depth: 18, skill: 20,
    elo: 2790, mult: 15.0,
    wins: 3401, losses: 31, draws: 219,
    taunt: "I have already seen this game end.",
  },
];

// NOTE: deepseek/deepseek-r1:free is a slow reasoning model — replaced with
// deepseek-chat-v3-0324:free which is fast, reliable, and equally strong for chat.

export const PLAYER_LEVELS = [
  { lvl:1,  name:"Pawn",         xp:0,      color:"#9ca3af" },
  { lvl:2,  name:"Squire",       xp:500,    color:"#34d399" },
  { lvl:3,  name:"Knight",       xp:1500,   color:"#38bdf8" },
  { lvl:4,  name:"Bishop",       xp:3500,   color:"#a78bfa" },
  { lvl:5,  name:"Rook",         xp:7000,   color:"#f59e0b" },
  { lvl:6,  name:"Grandmaster",  xp:15000,  color:"#f97316" },
  { lvl:7,  name:"Legend",       xp:30000,  color:"#ef4444" },
  { lvl:8,  name:"The Immortal", xp:60000,  color:"#c084fc" },
];

export function getLevel(xp) {
  let cur = PLAYER_LEVELS[0], nxt = PLAYER_LEVELS[1];
  for (let i = 0; i < PLAYER_LEVELS.length; i++) {
    if (xp >= PLAYER_LEVELS[i].xp) { cur = PLAYER_LEVELS[i]; nxt = PLAYER_LEVELS[i+1]||null; }
  }
  const pct = nxt ? ((xp - cur.xp) / (nxt.xp - cur.xp)) * 100 : 100;
  return { cur, nxt, pct: Math.min(pct, 100) };
}

export const ACHIEVEMENTS = [
  { id:"first_win",    icon:"🩸", name:"First Blood",        desc:"Win your first game",         xp:300,  check:s=>s.wins>=1 },
  { id:"speedster",    icon:"⚡", name:"Speed Demon",         desc:"Win in under 2 minutes",      xp:500,  check:s=>s.lastWin&&s.lastSec<120 },
  { id:"efficient",    icon:"♟", name:"The Efficient",       desc:"Win in under 25 moves",        xp:400,  check:s=>s.lastWin&&s.lastMoves<25 },
  { id:"streak3",      icon:"🔥", name:"Hat Trick",           desc:"Win 3 games in a row",         xp:600,  check:s=>s.streak>=3 },
  { id:"streak5",      icon:"💥", name:"Unstoppable",         desc:"Win 5 in a row",               xp:1200, check:s=>s.streak>=5 },
  { id:"apexkiller",   icon:"💀", name:"Apex Predator",       desc:"Defeat DeepSeek V3",           xp:2500, check:s=>s.lastWin&&s.lastTier===6 },
  { id:"masterkiller", icon:"🔱", name:"Titan Slayer",        desc:"Defeat Nemotron Super 120B",   xp:1200, check:s=>s.lastWin&&s.lastTier===5 },
  { id:"veteran",      icon:"🛡", name:"Veteran",             desc:"Play 20 games",                xp:500,  check:s=>s.games>=20 },
  { id:"comeback",     icon:"⚔️", name:"The Comeback",       desc:"Win after 3 straight losses",  xp:800,  check:s=>s.lastWin&&s.lossRun>=3 },
  { id:"byok",         icon:"🔑", name:"Bring Your Own Key", desc:"Play with a custom API key",   xp:200,  check:s=>s.usedBYOK },
  { id:"collector",    icon:"🏆", name:"Challenger",         desc:"Play every AI model at least once", xp:1000, check:s=>s.uniqueModels>=MODELS.length },
];

export function calcScore({ model, moves, seconds, streak }) {
  const base  = Math.round(1000 * model.mult);
  const speed = seconds < 90 ? 700 : seconds < 180 ? 350 : seconds < 300 ? 100 : 0;
  const eff   = moves < 20 ? 600 : moves < 30 ? 300 : moves < 45 ? 100 : 0;
  const strk  = Math.min(streak * 300, 1800);
  return { base, speed, eff, strk, total: base + speed + eff + strk };
}

export const INIT_LB = [
  { name:"GrandMagnus",  pts:148200, wins:52, lvl:7, apex:true,  streak:9 },
  { name:"NightOwl",     pts:92400,  wins:31, lvl:6, apex:false, streak:5 },
  { name:"QueenGambit",  pts:61300,  wins:22, lvl:5, apex:false, streak:3 },
  { name:"TacticianX",   pts:34800,  wins:14, lvl:4, apex:false, streak:2 },
  { name:"PawnStorm99",  pts:18100,  wins:8,  lvl:3, apex:false, streak:0 },
];

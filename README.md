# ♟ Chess Arena — AI Battle Royale

> **Challenge real AI models to chess. Climb a global leaderboard. Dethrone the Apex.**

A fully open-source, browser-based chess game where you don't play "the computer" — you challenge a roster of named AI models sourced from OpenRouter's free tier, each with their own Elo rating, personality, and score multiplier. Built on a modern serverless stack with zero ongoing hosting costs.

![Chess Arena](https://img.shields.io/badge/status-live-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Vercel](https://img.shields.io/badge/hosted_on-Vercel-00C7B7?style=flat-square&logo=vercel)
![Supabase](https://img.shields.io/badge/database-Supabase_Postgres-00E699?style=flat-square)
![OpenRouter](https://img.shields.io/badge/AI-OpenRouter_Free_Tier-orange?style=flat-square)

---

## ✨ Features

### 🎮 Gameplay
- **Full chess engine** — legal move validation, castling, en passant, pawn promotion, check/checkmate detection
- **Alpha-beta minimax AI** — pure JS engine with piece-square tables, no WASM, no CDN dependencies
- **10 difficulty tiers** — each mapped to a real AI model with increasing Stockfish depth and skill level
- **Score multipliers** — beating harder opponents earns up to **15×** your base points
- **Speed & efficiency bonuses** — win faster and in fewer moves for extra XP
- **Win streak multiplier** — consecutive wins stack bonus points up to +1,800 pts

### 🤖 AI Opponents
Each opponent is a real, named LLM from OpenRouter's free tier. They taunt you, react to your moves, and give post-game analysis — all powered by the model you're actually playing against.

| Model | Provider | Tier | Elo | Multiplier |
|---|---|---|---|---|
| Gemma 3 4B | Google | Recruit | 680 | 1.0× |
| LFM 1.2B | LiquidAI | Recruit | 720 | 1.2× |
| Llama 3.2 3B | Meta | Apprentice | 820 | 1.5× |
| Gemma 3 12B | Google | Apprentice | 960 | 2.0× |
| Nemotron Nano 9B | NVIDIA | Knight | 1,180 | 3.0× |
| Mistral Small 3.1 | Mistral AI | Knight | 1,340 | 4.0× |
| Llama 3.3 70B | Meta | Elite | 1,590 | 6.0× |
| Gemma 3 27B | Google | Elite | 1,680 | 7.0× |
| Nemotron Super 120B | NVIDIA | Master | 2,090 | 10.0× |
| Qwen3 Next 80B | Alibaba Cloud | Master | 2,210 | 11.0× |
| DeepSeek V3 | DeepSeek | **Apex** | **2,790** | **15.0×** |

> All models are free on OpenRouter. No credit card required. Rate limits apply on the free tier.

### 📊 Progression System
- **8 player levels** — Pawn → Squire → Knight → Bishop → Rook → Grandmaster → Legend → The Immortal
- **XP system** — every win earns XP toward the next level
- **13 achievements** with XP rewards (First Blood, Speed Demon, Hat Trick, Apex Predator, and more)
- **Player profile** — stats, per-model breakdown, recent game history, achievement showcase
- **Persistent progress** — saved to `localStorage` locally, synced to Supabase globally

### 🌍 Global Leaderboard (Optional)
- Player rankings by total score, powered by **Supabase Serverless Postgres**
- Live AI model rankings — tracks each model's wins/losses against humans across all players
- Gracefully degrades — the game works perfectly without a database; local scores always save
- Auto-creates database tables on first game (or run `supabase-setup.sql` manually for indexes + seed data)

### 🔑 BYOK (Bring Your Own Key)
- Paste your own [OpenRouter API key](https://openrouter.ai/keys) to unlock premium models (GPT-4o, Claude, Gemini, etc.)
- Key stored in `localStorage`, passed securely as a header — never hardcoded or exposed in the bundle
- Works without a key using free-tier models only

---

## 🏗 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Vite | UI, game state, routing |
| **Chess Logic** | chess.js | Move validation, game state |
| **Chess AI** | Custom minimax engine | Alpha-beta pruning + piece-square tables |
| **AI Personality** | OpenRouter API | Villain taunts, commentary, post-game analysis |
| **Backend** | Vercel Functions | Secure OpenRouter proxy, DB operations |
| **Database** | Supabase Serverless Postgres | Global leaderboard + AI model stats |
| **Hosting** | Vercel Free Tier | Static site + serverless functions |

### Why this stack is $0/month
- **Vercel Free**: 125k function invocations/month, 100GB bandwidth
- **Supabase Free**: 0.5 GB storage, serverless auto-suspend (no idle costs)
- **OpenRouter Free**: All models used have a `:free` variant
- **No WASM, no CDN workers** — the chess engine is pure JS, bundled with the app

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Vercel](https://vercel.com) account (free)
- An [OpenRouter](https://openrouter.ai) account (free) — for AI villain speech
- A [Supabase](https://supabase.com) account (free, optional) — for the global leaderboard

### 1. Clone & Install

```bash
git clone https://github.com/allenki1eo/chess_arena.git
cd chess_arena
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required for AI villain speech (taunts, commentary, analysis)
# Get your free key at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional — enables the global leaderboard
# Get your connection string from supabase.com → your project → Settings → Connection
SUPABASE_URL + SUPABASE_SERVICE_KEY=postgres://user:pass@ep-xxx.supabase.com/neondb?sslmode=require
```

> **Note:** The game works without both variables. Without `OPENROUTER_API_KEY`, villains use fallback lines. Without `SUPABASE_URL + SUPABASE_SERVICE_KEY`, scores save locally only.

### 3. Run Locally

```bash
# Install Vercel CLI (one-time)
npm install -g vercel-cli

# Start dev server + local functions
vercel dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🗄 Database Setup (Optional)

If you want the global leaderboard, run `supabase-setup.sql` once in the [Supabase SQL Editor](https://console.supabase.com):

```sql
-- Creates 3 tables, 6 indexes, 3 views, 1 cleanup trigger, and seeds AI model data
-- Safe to run multiple times (all statements are idempotent)
```

Copy the full contents of [`supabase-setup.sql`](./supabase-setup.sql) and paste it into the Supabase SQL Editor → click **Run**.

**What gets created:**

| Object | Type | Purpose |
|---|---|---|
| `players` | Table | One row per player — score, wins, level, streak |
| `ai_models` | Table | Win/loss record for each AI model |
| `game_history` | Table | Every game ever played (auto-cleaned at 10k rows) |
| `leaderboard` | View | Top 20 players ordered by score |
| `ai_rankings` | View | AI models ordered by wins against humans |
| `recent_activity` | View | Last 50 games across all players |

> Tables are also **auto-created on the first game** by the Vercel function — running `supabase-setup.sql` manually is only needed if you want the indexes, views, and seeded AI data before the first player signs up.

---

## ☁️ Deploy to Vercel

### Option A — Git push (recommended)

1. Push this repo to GitHub
2. Go to [app.vercel.com](https://app.vercel.com) → **Add new site** → **Import from Git**
3. Build settings are auto-detected from `vercel.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add environment variables: **Site configuration → Environment variables**
   - `OPENROUTER_API_KEY` — your OpenRouter key
   - `SUPABASE_URL + SUPABASE_SERVICE_KEY` — your Supabase connection string (optional)
5. **Deploy site** ✓

### Option B — Vercel CLI

```bash
vercel login
vercel init          # Connect to your Vercel account
vercel deploy --prod # Deploy to production
```

---

## 📁 Project Structure

```
chess_arena/
├── vercel/
│   └── functions/
│       ├── ai-chat.js            # Secure OpenRouter proxy (BYOK + DeepSeek <think> strip)
│       ├── leaderboard-get.js    # Fetch top players + AI stats from Supabase
│       └── leaderboard-save.js   # Upsert player result + AI record after each game
│
├── src/
│   ├── components/
│   │   └── ProfilePage.jsx       # 5-tab player profile modal
│   ├── utils/
│   │   ├── aiChat.js             # Client-side OpenRouter caller (BYOK header)
│   │   ├── gameData.js           # AI models, scoring rules, levels, achievements
│   │   ├── playerDB.js           # localStorage profile + Supabase sync utilities
│   │   └── stockfish.js          # Pure JS minimax engine (alpha-beta + PST)
│   ├── App.jsx                   # Main app — all screens + game logic
│   └── main.jsx                  # React entry point
│
├── supabase-setup.sql                    # Supabase database schema (run once to set up)
├── index.html                    # Vite entry point
├── vercel.toml                  # Build config + function settings
├── vite.config.js                # Vite config
└── package.json
```

---

## 🧠 How the Chess Engine Works

The AI doesn't use Stockfish WASM (which has CORS/MIME issues on deployment). Instead, it uses a custom **pure-JS minimax engine** bundled directly with the app:

- **Alpha-beta pruning** — eliminates losing branches early, enabling deeper search in the same time
- **Piece-square tables** — bonuses/penalties for piece placement (e.g. knights are rewarded for controlling the center)
- **Move ordering** — captures are searched first, improving pruning efficiency
- **Skill noise** — lower-tier opponents get random noise added to their evaluation scores, making them genuinely weaker

Each villain maps to a specific `depth` (search depth) and `skill` (noise level):

```js
// Recruit: depth 2, skill 1 — shallow search, lots of noise
// Apex:    depth 18, skill 20 — deep search, zero noise
```

---

## 🤖 How AI Speech Works

The `ai-chat` Vercel function acts as a secure proxy to OpenRouter:

1. **Taunt** — fired when a battle starts. The villain introduces themselves.
2. **React** — fired every 3 player moves. The villain reacts to what you just played.
3. **Analysis** — fired after the game ends. The villain gives post-game commentary.

**DeepSeek V3 fix:** DeepSeek models output a `<think>...</think>` reasoning block before their response. The function strips this automatically before returning text to the client.

```js
// Before stripping:
// "<think>\nLet me think about this chess position...\n</think>\n\nYour defeat was inevitable."

// After:
// "Your defeat was inevitable."
```

The game **never waits** for AI speech — commentary fires async with `.then()` and updates the speech bubble whenever the response arrives. Your moves are never blocked.

---

## 🏆 Achievements

| Achievement | Condition | XP Reward |
|---|---|---|
| 🩸 First Blood | Win your first game | +300 |
| ⚡ Speed Demon | Win in under 2 minutes | +500 |
| ♟ The Efficient | Win in under 25 moves | +400 |
| 🔥 Hat Trick | Win 3 games in a row | +600 |
| 💥 Unstoppable | Win 5 games in a row | +1,200 |
| 💀 Apex Predator | Defeat DeepSeek V3 | +2,500 |
| 🔱 Titan Slayer | Defeat Nemotron Super 120B | +1,200 |
| 🛡 Veteran | Play 20 games | +500 |
| ⚔️ The Comeback | Win after 3 straight losses | +800 |
| 🔑 Bring Your Own Key | Play with a custom API key | +200 |

---

## 🔧 Configuration

### Adding a New AI Villain

1. Add the model to `MODELS` in `src/utils/gameData.js`:

```js
{
  id: "provider/model-name:free",   // OpenRouter model ID
  name: "Model Display Name",
  label: "VILLAIN CODENAME",
  provider: "Provider Name",
  avatar: "🦾",
  color: "#hexcolor",
  glow: "rgba(r,g,b,0.4)",
  bg: "rgba(r,g,b,0.08)",
  tier: "Elite",
  tierNum: 4,              // Used for achievement checks
  depth: 8,                // Minimax search depth (1–18)
  skill: 12,               // Skill level 0–20 (0 = max noise = weakest)
  elo: 1600,
  mult: 6.0,               // Score multiplier
  wins: 0, losses: 0, draws: 0,
  taunt: "Your fallback taunt if AI API is unavailable.",
  stripThinking: false,    // Set true for models like DeepSeek R1 that output <think> blocks
}
```

2. Add a persona in `vercel/functions/ai-chat.js`:

```js
"provider/model-name:free":
  "You are [Villain Name] — [personality description]. MAX 2 sentences. No quotes.",
```

3. Add a seed row to `supabase-setup.sql` if using Supabase:

```sql
INSERT INTO ai_models (model_id, model_name, provider, tier)
VALUES ('provider/model-name:free', 'Model Display Name', 'Provider', 'Elite')
ON CONFLICT (model_id) DO NOTHING;
```

### Changing Score Multipliers

Edit `calcScore` in `src/utils/gameData.js`:

```js
export function calcScore({ model, moves, seconds, streak }) {
  const base  = Math.round(1000 * model.mult);  // Base × villain multiplier
  const speed = seconds < 90 ? 700 : seconds < 180 ? 350 : seconds < 300 ? 100 : 0;
  const eff   = moves < 20   ? 600 : moves  <  30  ? 300 : moves  <  45  ? 100 : 0;
  const strk  = Math.min(streak * 300, 1800);   // Max 1,800 streak bonus
  return { base, speed, eff, strk, total: base + speed + eff + strk };
}
```

---

## 🤝 Contributing

Contributions are welcome! Here are good places to start:

- **New villain personas** — write more interesting personality prompts in `ai-chat.js`
- **New achievements** — add to `ACHIEVEMENTS` array in `gameData.js`
- **Board themes** — add board color variants (currently obsidian/gold)
- **Mobile layout** — the sidebars hide on mobile; a dedicated mobile layout would be great
- **AI vs AI mode** — scheduled Vercel function to run background matches (designed for it, not yet built)
- **Sound effects** — move clicks, capture sounds, check alarm

### How to contribute

```bash
# 1. Fork the repo
# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes
# 4. Test locally with vercel dev
vercel dev

# 5. Open a Pull Request
```

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

Feel free to fork, self-host, add models, and make it your own. If you build something cool on top of this, open a PR or tag me on Twitter.

---

## 🙏 Acknowledgements

- [chess.js](https://github.com/jhlywa/chess.js) — chess move validation and game state
- [OpenRouter](https://openrouter.ai) — unified API for 200+ LLMs, including free tier
- [Supabase](https://supabase.com) — serverless Postgres with a generous free tier
- [Vercel](https://vercel.com) — hosting + serverless functions, free tier
- The open-source AI community for making powerful models freely accessible

---

<div align="center">

**Built with ♟ and too much caffeine**

[Live Demo](https://chess-arena-six.vercel.app/) · [Report a Bug](https://github.com/allenki1eo/chess_arena/issues) · [Request a Feature](https://github.com/allenki1eo/chess_arena/issues)

</div>

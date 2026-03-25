/**
 * api/leaderboard-save.js — Vercel Serverless Function
 * Upserts player stats + AI model record into Supabase after every game.
 *
 * Required env vars (set in Vercel dashboard → Settings → Environment Variables):
 *   SUPABASE_URL         https://your-ref.supabase.co
 *   SUPABASE_SERVICE_KEY service_role key (NOT the anon key)
 *
 * POST body:
 *   { username, score, won, modelId, modelName, streak, level, defeatedApex, moves, seconds }
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn("Supabase env vars missing — SUPABASE_URL or SUPABASE_SERVICE_KEY not set");
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ saved: false, reason: "no_db" });
  }

  const {
    username,
    score     = 0,
    won       = false,
    modelId   = "unknown",
    modelName = "Unknown",
    streak    = 0,
    level     = 1,
    defeatedApex = false,
    moves     = 0,
    seconds   = 0,
  } = req.body || {};

  // Validate and sanitize username
  if (!username) return res.status(400).json({ error: "Missing username" });
  const cleanName = String(username).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  if (!cleanName) return res.status(400).json({ error: "Invalid username" });

  try {
    // ── 1. Fetch current player row to accumulate totals ──────────────────────
    const { data: existing, error: fetchErr } = await supabase
      .from("players")
      .select("total_score, total_wins, total_losses, total_draws, total_games, best_streak, defeated_apex")
      .eq("username", cleanName)
      .maybeSingle();

    if (fetchErr) {
      console.error("Fetch player error:", fetchErr.message);
      // Continue anyway — we'll just create a fresh row
    }

    const prev = existing || {
      total_score: 0, total_wins: 0, total_losses: 0,
      total_draws: 0, total_games: 0, best_streak: 0, defeated_apex: false,
    };

    const isWin  = won === true;
    const isLose = !won && score === 0;
    const isDraw = !won && score > 0;

    // ── 2. Upsert player row ──────────────────────────────────────────────────
    const { error: upsertErr } = await supabase
      .from("players")
      .upsert({
        username:          cleanName,
        total_score:       (prev.total_score || 0) + score,
        total_wins:        (prev.total_wins  || 0) + (isWin  ? 1 : 0),
        total_losses:      (prev.total_losses|| 0) + (isLose ? 1 : 0),
        total_draws:       (prev.total_draws || 0) + (isDraw ? 1 : 0),
        total_games:       (prev.total_games || 0) + 1,
        best_streak:       Math.max(prev.best_streak || 0, streak),
        player_level:      level,
        defeated_apex:     (prev.defeated_apex || false) || defeatedApex,
        favorite_opponent: modelName,
        last_played:       new Date().toISOString(),
      }, { onConflict: "username" });

    if (upsertErr) {
      console.error("Player upsert error:", upsertErr.message, upsertErr.details);
      return res.status(200).json({ saved: false, error: upsertErr.message });
    }

    // ── 3. Upsert AI model stats ──────────────────────────────────────────────
    const { data: existingAI } = await supabase
      .from("ai_models")
      .select("wins_against_humans, losses_to_humans, draws, total_games")
      .eq("model_id", modelId)
      .maybeSingle();

    const prevAI = existingAI || { wins_against_humans: 0, losses_to_humans: 0, draws: 0, total_games: 0 };

    const { error: aiErr } = await supabase
      .from("ai_models")
      .upsert({
        model_id:             modelId,
        model_name:           modelName,
        wins_against_humans:  (prevAI.wins_against_humans || 0) + (isWin  ? 0 : isLose ? 1 : 0),
        losses_to_humans:     (prevAI.losses_to_humans    || 0) + (isWin  ? 1 : 0),
        draws:                (prevAI.draws               || 0) + (isDraw ? 1 : 0),
        total_games:          (prevAI.total_games         || 0) + 1,
        last_played:          new Date().toISOString(),
      }, { onConflict: "model_id" });

    if (aiErr) console.warn("AI model upsert warning:", aiErr.message);

    // ── 4. Insert game history row ────────────────────────────────────────────
    const result = isWin ? "win" : isDraw ? "draw" : "lose";
    const { error: histErr } = await supabase
      .from("game_history")
      .insert({
        username:      cleanName,
        model_id:      modelId,
        model_name:    modelName,
        result,
        score_earned:  score,
        move_count:    moves,
        duration_secs: seconds,
        played_at:     new Date().toISOString(),
      });

    if (histErr) console.warn("History insert warning:", histErr.message);

    console.log(`✓ Saved: ${cleanName} ${result} vs ${modelName} (+${score} pts)`);
    return res.status(200).json({ saved: true });

  } catch (err) {
    console.error("leaderboard-save unhandled error:", err.message, err.stack);
    return res.status(200).json({ saved: false, error: err.message });
  }
}

/**
 * api/leaderboard-save.js  —  Vercel Serverless Function
 * Upserts player stats + AI model record after every game.
 * Uses Supabase's upsert — no raw SQL, no table creation needed at runtime.
 * Tables must exist first — run supabase-setup.sql in the Supabase SQL Editor.
 *
 * Required env vars:
 *   SUPABASE_URL         — https://your-ref.supabase.co
 *   SUPABASE_SERVICE_KEY — service_role key (has write access)
 *
 * POST body: { username, score, won, modelId, modelName, streak, level, defeatedApex, moves, seconds }
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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
    // No DB configured — silently succeed so game never breaks
    return res.status(200).json({ saved: false, reason: "no_db" });
  }

  const {
    username, score = 0, won = false,
    modelId, modelName, streak = 0,
    level = 1, defeatedApex = false,
    moves = 0, seconds = 0,
  } = req.body || {};

  if (!username) return res.status(400).json({ error: "Missing username" });

  // Sanitise username
  const cleanName = String(username).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  if (!cleanName) return res.status(400).json({ error: "Invalid username" });

  try {
    // ── 1. Fetch existing player row (to compute running totals) ──────────────
    const { data: existing } = await supabase
      .from("players")
      .select("total_score, total_wins, total_losses, total_draws, total_games, best_streak, defeated_apex")
      .eq("username", cleanName)
      .maybeSingle();

    const prev = existing || {
      total_score: 0, total_wins: 0, total_losses: 0,
      total_draws: 0, total_games: 0, best_streak: 0, defeated_apex: false,
    };

    // ── 2. Upsert player ──────────────────────────────────────────────────────
    const { error: pErr } = await supabase
      .from("players")
      .upsert({
        username:          cleanName,
        total_score:       prev.total_score + score,
        total_wins:        prev.total_wins  + (won ? 1 : 0),
        total_losses:      prev.total_losses + (!won && score === 0 ? 1 : 0),
        total_draws:       prev.total_draws  + (!won && score > 0 ? 0 : 0),
        total_games:       prev.total_games  + 1,
        best_streak:       Math.max(prev.best_streak, streak),
        player_level:      level,
        defeated_apex:     prev.defeated_apex || defeatedApex,
        favorite_opponent: modelName || null,
        last_played:       new Date().toISOString(),
      }, { onConflict: "username" });

    if (pErr) throw pErr;

    // ── 3. Upsert AI model record ─────────────────────────────────────────────
    if (modelId) {
      const { data: existingAI } = await supabase
        .from("ai_models")
        .select("wins_against_humans, losses_to_humans, total_games")
        .eq("model_id", modelId)
        .maybeSingle();

      const prevAI = existingAI || { wins_against_humans: 0, losses_to_humans: 0, total_games: 0 };

      const { error: aErr } = await supabase
        .from("ai_models")
        .upsert({
          model_id:             modelId,
          model_name:           modelName || modelId,
          wins_against_humans:  prevAI.wins_against_humans + (won ? 0 : 1),
          losses_to_humans:     prevAI.losses_to_humans    + (won ? 1 : 0),
          total_games:          prevAI.total_games + 1,
          last_played:          new Date().toISOString(),
        }, { onConflict: "model_id" });

      if (aErr) console.warn("AI model upsert warning:", aErr.message);
    }

    // ── 4. Insert game history ────────────────────────────────────────────────
    await supabase.from("game_history").insert({
      username:     cleanName,
      model_id:     modelId || "unknown",
      model_name:   modelName || "Unknown",
      result:       won ? "win" : "lose",
      score_earned: score,
      move_count:   moves,
      duration_secs: seconds,
    });

    return res.status(200).json({ saved: true });
  } catch (err) {
    console.error("leaderboard-save error:", err.message);
    // Never crash the game
    return res.status(200).json({ saved: false, error: err.message });
  }
}

/**
 * api/leaderboard-get.js  —  Vercel Serverless Function
 * Fetches top 20 players + AI model stats from Supabase.
 * Gracefully returns empty arrays if Supabase not configured.
 *
 * Required env vars (set in Vercel dashboard):
 *   SUPABASE_URL         — https://your-ref.supabase.co
 *   SUPABASE_SERVICE_KEY — service_role key (from Supabase → Settings → API)
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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ players: [], aiStats: [], source: "none" });
  }

  try {
    // Top 20 players by score
    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("username, total_score, total_wins, total_games, best_streak, player_level, defeated_apex, favorite_opponent, last_played")
      .order("total_score", { ascending: false })
      .limit(20);

    if (pErr) throw pErr;

    // AI model rankings
    const { data: aiStats, error: aErr } = await supabase
      .from("ai_models")
      .select("model_id, model_name, wins_against_humans, losses_to_humans, total_games")
      .order("wins_against_humans", { ascending: false });

    if (aErr) throw aErr;

    return res.status(200).json({ players: players || [], aiStats: aiStats || [], source: "supabase" });
  } catch (err) {
    console.error("leaderboard-get error:", err.message);
    return res.status(200).json({ players: [], aiStats: [], source: "error", error: err.message });
  }
}

/**
 * api/profile-load.js — Vercel Serverless Function
 * Loads a player's core stats from Supabase by username.
 * Used to restore a profile on a new device.
 *
 * GET /api/profile-load?username=Hanki
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();

  const username = req.query?.username || "";
  const clean = String(username).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  if (!clean) return res.status(400).json({ error: "Missing username" });

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ player: null, reason: "no_db" });

  try {
    const { data, error } = await supabase
      .from("players")
      .select(
        "username, total_score, total_wins, total_losses, total_draws, total_games, best_streak, player_level, defeated_apex"
      )
      .eq("username", clean)
      .maybeSingle();

    if (error) throw error;
    return res.status(200).json({ player: data || null });
  } catch (err) {
    console.error("profile-load error:", err.message);
    return res.status(200).json({ player: null, error: err.message });
  }
}

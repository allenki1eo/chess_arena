/**
 * api/debug.js — Connectivity check endpoint
 * Visit https://your-site.vercel.app/api/debug to verify env vars + Supabase connection
 * DELETE THIS FILE before going to production if you want
 */
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const orKey = process.env.OPENROUTER_API_KEY;

  const status = {
    SUPABASE_URL:         url ? `✓ set (${url.slice(0,30)}...)` : "✗ MISSING",
    SUPABASE_SERVICE_KEY: key ? `✓ set (${key.slice(0,8)}...)` : "✗ MISSING",
    OPENROUTER_API_KEY:   orKey ? `✓ set (${orKey.slice(0,12)}...)` : "✗ MISSING",
    supabase_connection:  "not tested",
    players_table:        "not tested",
    ai_models_table:      "not tested",
  };

  if (url && key) {
    try {
      const supabase = createClient(url, key, { auth: { persistSession: false } });

      const { data, error } = await supabase.from("players").select("count").limit(1);
      status.players_table = error ? `✗ Error: ${error.message}` : "✓ reachable";

      const { data: ai, error: aiErr } = await supabase.from("ai_models").select("count").limit(1);
      status.ai_models_table = aiErr ? `✗ Error: ${aiErr.message}` : "✓ reachable";

      status.supabase_connection = "✓ connected";
    } catch (e) {
      status.supabase_connection = `✗ ${e.message}`;
    }
  }

  return res.status(200).json(status);
}

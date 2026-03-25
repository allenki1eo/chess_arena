// src/utils/aiChat.js
// Client-side caller for Vercel /api/ai-chat.
// Supports BYOK via X-User-Key header.
export async function aiChat({ type, modelId, data = {}, userKey = null }) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (userKey) headers["X-User-Key"] = userKey;
    const r = await fetch("/api/ai-chat", {
      method: "POST", headers,
      body: JSON.stringify({ type, modelId, data }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()).text || null;
  } catch { return null; }
}

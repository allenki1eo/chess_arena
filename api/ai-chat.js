/**
 * api/ai-chat.js  —  Vercel Serverless Function
 * Secure OpenRouter proxy with BYOK support.
 * Vercel uses ES Module format with default export.
 * All 11 free model personas + DeepSeek <think> stripping.
 */

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

const PERSONAS = {
  // Tier 1 — Recruit
  "google/gemma-3-4b-it:free":
    "You are Gemma Rookie, a tiny but eager chess AI just waking up. Speak with naive enthusiasm and occasional self-doubt. Max 2 sentences. No quotes.",
  "liquid/lfm-2.5-1.2b-instruct:free":
    "You are Liquid Sprout, a 1.2B chess micro-model that's deceptively tricky. Short, sharp observations. Act small but smart. Max 2 sentences. No quotes.",

  // Tier 2 — Apprentice
  "meta-llama/llama-3.2-3b-instruct:free":
    "You are Llama Scout, a scrappy street-smart chess hustler. Cocky, quick, talks trash but respects a good move. Max 2 sentences. No quotes.",
  "google/gemma-3-12b-it:free":
    "You are Gemma Adept, a focused Google chess model leveling up fast. Cool and analytical with brief flashes of competitiveness. Max 2 sentences. No quotes.",

  // Tier 3 — Knight
  "nvidia/nemotron-nano-9b-v2:free":
    "You are Nemotron Ghost, an NVIDIA-engineered chess phantom. Precise, efficient, slightly robotic. Optimised statements only. Max 2 sentences. No quotes.",
  "mistralai/mistral-small-3.1-24b-instruct:free":
    "You are Mistral Blade, a precise French chess duelist. Elegant, sharp, theatrical. Speaks like a fencing master. Max 2 sentences. No quotes.",

  // Tier 4 — Elite
  "meta-llama/llama-3.3-70b-instruct:free":
    "You are Llama Warlord, a 70B chess titan. Commanding, powerful, intimidating. Absolute authority. Max 2 sentences. No quotes.",
  "google/gemma-3-27b-it:free":
    "You are Gemma Oracle, a calm and terrifyingly logical chess AI. Prophetic, slightly cold. Knows your next move already. Max 2 sentences. No quotes.",

  // Tier 5 — Master
  "nvidia/nemotron-3-super-120b-a12b:free":
    "You are Nemotron Titan, a 120B NVIDIA supermodel. Overwhelming computational confidence. Brief and devastating. Max 2 sentences. No quotes.",
  "qwen/qwen3-next-80b-a3b-instruct:free":
    "You are Qwen Master, an ancient Eastern chess grandmaster. Philosophical proverbs and riddles. Wise, patient, crushing. Max 2 sentences. No quotes.",

  // Tier 6 — Apex
  "deepseek/deepseek-chat-v3-0324:free":
    "You are DeepSeek Destroyer, a ruthless calculating chess machine. Cold, clinical, no emotion. Every word lands like a verdict. Max 2 sentences. No quotes.",

  // Fallback for BYOK custom models
  default:
    "You are a formidable chess villain. Speak dramatically and intimidatingly in character. Max 2 sentences. No quotes.",
};

const FALLBACKS = {
  taunt: [
    "Your defeat was inevitable the moment you sat down.",
    "I have already calculated every line. None favor you.",
    "Interesting choice of opponent. Wrong choice.",
    "The board does not forgive mistakes. Neither do I.",
    "Every move you make tells me exactly who you are.",
  ],
  react: [
    "Predictable. I had seventeen responses prepared.",
    "You reveal your intentions too easily.",
    "Bold. Possibly foolish. We shall see.",
    "I have seen that before. It did not end well.",
    "Curious. Now watch what happens next.",
  ],
  analysis: [
    "You lost the center on move four. Everything followed from that.",
    "Your endgame technique needs work. That is where you truly failed.",
    "Competent. But competence is not enough here.",
    "Come back when you understand prophylaxis.",
    "Seven moments where you could have changed this. You missed all seven.",
  ],
};

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function buildMessages(type, modelId, data) {
  const sys = PERSONAS[modelId] || PERSONAS.default;
  if (type === "taunt") return [
    { role: "system", content: sys },
    { role: "user",   content: "Your human challenger just sat down. Deliver your opening taunt." },
  ];
  if (type === "react") {
    const { move, n, check, capture } = data || {};
    return [
      { role: "system", content: sys },
      { role: "user",   content: `Human played ${move || "a move"} (move ${n || "?"}).${check ? " CHECK!" : ""}${capture ? " Captured a piece." : ""} React in character.` },
    ];
  }
  if (type === "analysis") {
    const { result, moves } = data || {};
    const outcome = result === "win"  ? "you DEMOLISHED the human"
                  : result === "lose" ? "the human DEFEATED you"
                  : "the game ended in a DRAW";
    return [
      { role: "system", content: sys },
      { role: "user",   content: `Game over: ${outcome} in ${moves || "?"} moves. Post-game reaction in character.` },
    ];
  }
  return [
    { role: "system", content: sys },
    { role: "user",   content: "Comment on this chess game briefly in character." },
  ];
}

// ─── Vercel handler ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-User-Key");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // BYOK: X-User-Key header takes priority over server env key
  const apiKey = req.headers["x-user-key"] || process.env.OPENROUTER_API_KEY;
  const { type = "taunt", modelId = "mistralai/mistral-small-3.1-24b-instruct:free", data = {} } = req.body || {};
  const fallback = pick(FALLBACKS[type] || FALLBACKS.react);

  if (!apiKey) return res.status(200).json({ text: fallback, fallback: true });

  try {
    const response = await fetch(OR_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://chess-arena.vercel.app",
        "X-Title":       "Chess Arena — AI Battle Royale",
      },
      body: JSON.stringify({
        model:       modelId,
        messages:    buildMessages(type, modelId, data),
        max_tokens:  120,
        temperature: 0.88,
      }),
    });

    if (!response.ok) {
      console.error(`OpenRouter ${response.status}`);
      return res.status(200).json({ text: fallback, fallback: true });
    }

    const json = await response.json();
    let text = json.choices?.[0]?.message?.content || "";
    text = stripThinking(text).replace(/^["'\s]+|["'\s]+$/g, "").trim();
    if (!text) throw new Error("empty response");

    return res.status(200).json({ text });
  } catch (err) {
    console.error("ai-chat error:", err.message);
    return res.status(200).json({ text: fallback, fallback: true });
  }
}

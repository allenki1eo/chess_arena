# Contributing to Chess Arena

Thank you for considering a contribution! This is a small open-source project and all help is appreciated.

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/chess-arena.git
cd chess-arena
npm install
cp .env.example .env   # Add your keys
vercel dev            # Start dev server + functions
```

## What's Worth Contributing

| Area | Where to look | Difficulty |
|---|---|---|
| New AI villain personas | `api//ai-chat.js` | Easy |
| New achievements | `src/utils/gameData.js` → `ACHIEVEMENTS` | Easy |
| Bug fixes | Issues tab | Varies |
| Mobile layout improvements | `src/App.jsx` → CSS at the bottom | Medium |
| Board/piece themes | `src/App.jsx` → `.sq-l`, `.sq-d` CSS vars | Medium |
| AI vs AI background matches | New Vercel scheduled function | Medium |
| Sound effects | `src/App.jsx` → game events | Medium |
| New scoring mechanics | `src/utils/gameData.js` → `calcScore` | Easy |

## Ground Rules

- **Test locally** with `vercel dev` before submitting a PR — this runs both the Vite dev server and the Vercel Functions together.
- **Keep it free** — don't add dependencies that require paid API keys to work at all. The game must function on the free tier.
- **Don't break BYOK** — the `X-User-Key` header flow in `ai-chat.js` must continue to work for users bringing their own OpenRouter key.
- **One PR per change** — keep pull requests focused. A PR that adds a new villain model + fixes a bug + changes the scoring is hard to review.

## Adding a New AI Model — Checklist

- [ ] Add entry to `MODELS` array in `src/utils/gameData.js` (include `stripThinking: true` if it's a reasoning model like DeepSeek R1)
- [ ] Add persona string to `PERSONAS` in `api//ai-chat.js`
- [ ] Add to `STRIP_THINKING_MODELS` Set in `ai-chat.js` if the model outputs `<think>` blocks
- [ ] Add a seed `INSERT` row to `schema.sql`
- [ ] Test that the model ID is valid on OpenRouter's free tier

## Code Style

- No TypeScript — plain JS/JSX throughout
- No CSS modules — styles are colocated as template literals at the bottom of each component file
- CSS custom properties (`var(--c)`) for anything that needs to vary by villain color theme
- `useCallback` on all event handlers passed as props to prevent unnecessary re-renders

## Reporting Bugs

Open an issue with:
1. What you expected to happen
2. What actually happened
3. Steps to reproduce
4. Browser + OS

## Questions

Open a Discussion on GitHub or reach out on Twitter.

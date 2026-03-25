// src/utils/stockfish.js
// Pure JS minimax engine — zero WASM, zero workers, zero CORS, works everywhere.
// Uses chess.js for legal move generation (already a project dependency).
// Alpha-beta pruning + piece-square tables = strong enough for all villain tiers.

// ─── Piece values ─────────────────────────────────────────────────────────────
const VAL = { p:100, n:320, b:330, r:500, q:900, k:20000 };

// ─── Piece-square tables (white perspective, rank 1 = index 0) ────────────────
const PST = {
  p: [ 0, 0, 0, 0, 0, 0, 0, 0,
      50,50,50,50,50,50,50,50,
      10,10,20,30,30,20,10,10,
       5, 5,10,25,25,10, 5, 5,
       0, 0, 0,20,20, 0, 0, 0,
       5,-5,-10,0, 0,-10,-5, 5,
       5,10,10,-20,-20,10,10, 5,
       0, 0, 0, 0, 0, 0, 0, 0 ],
  n: [-50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50 ],
  b: [-20,-10,-10,-10,-10,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5, 10, 10,  5,  0,-10,
      -10,  5,  5, 10, 10,  5,  5,-10,
      -10,  0, 10, 10, 10, 10,  0,-10,
      -10, 10, 10, 10, 10, 10, 10,-10,
      -10,  5,  0,  0,  0,  0,  5,-10,
      -20,-10,-10,-10,-10,-10,-10,-20 ],
  r: [  0,  0,  0,  0,  0,  0,  0,  0,
         5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
         0,  0,  0,  5,  5,  0,  0,  0 ],
  q: [-20,-10,-10, -5, -5,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5,  5,  5,  5,  0,-10,
       -5,  0,  5,  5,  5,  5,  0, -5,
        0,  0,  5,  5,  5,  5,  0, -5,
      -10,  5,  5,  5,  5,  5,  0,-10,
      -10,  0,  5,  0,  0,  0,  0,-10,
      -20,-10,-10, -5, -5,-10,-10,-20 ],
  k: [-30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -10,-20,-20,-20,-20,-20,-20,-10,
       20, 20,  0,  0,  0,  0, 20, 20,
       20, 30, 10,  0,  0, 10, 30, 20 ],
};

// ─── Board evaluation ─────────────────────────────────────────────────────────
function evaluate(chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -99999 : 99999;
  if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) return 0;

  let score = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      const isWhite = sq.color === 'w';
      const pieceVal = VAL[sq.type] || 0;
      // PST: white reads top-to-bottom as rank8..rank1, black mirrors
      const pstIdx = isWhite ? r * 8 + f : (7 - r) * 8 + f;
      const pstVal = PST[sq.type]?.[pstIdx] || 0;
      score += isWhite ? (pieceVal + pstVal) : -(pieceVal + pstVal);
    }
  }
  return score;
}

// ─── Move ordering (captures first = better alpha-beta pruning) ───────────────
function orderMoves(moves) {
  return moves.sort((a, b) => {
    const aVal = a.captured ? (VAL[a.captured] || 0) : 0;
    const bVal = b.captured ? (VAL[b.captured] || 0) : 0;
    return bVal - aVal;
  });
}

// ─── Alpha-beta minimax ───────────────────────────────────────────────────────
function alphaBeta(chess, depth, alpha, beta, maximizing) {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess);

  const moves = orderMoves(chess.moves({ verbose: true }));

  if (maximizing) {
    let best = -Infinity;
    for (const mv of moves) {
      chess.move(mv);
      best = Math.max(best, alphaBeta(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const mv of moves) {
      chess.move(mv);
      best = Math.min(best, alphaBeta(chess, depth - 1, alpha, beta, true));
      chess.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ─── Add randomness for lower skill levels ────────────────────────────────────
function addNoise(score, skill) {
  // skill 0-20: higher skill = less noise
  const noiseFactor = Math.max(0, (20 - skill) * 8);
  return score + (Math.random() - 0.5) * noiseFactor;
}

// ─── Public: get best move ────────────────────────────────────────────────────
// Returns Promise<{from, to, promotion}|null> — async API matches old stockfish wrapper
export function getBestMove(fen, depth, skill, chess) {
  return new Promise(resolve => {
    // Small setTimeout so UI can update before we block
    setTimeout(() => {
      try {
        if (!chess || chess.isGameOver()) { resolve(null); return; }

        const moves = orderMoves(chess.moves({ verbose: true }));
        if (!moves.length) { resolve(null); return; }

        // Cap depth based on skill (low skill = shallow search = weaker)
        const effectiveDepth = Math.max(1, Math.min(depth, skill <= 4 ? 2 : skill <= 10 ? 3 : depth));

        let bestMove = null;
        let bestScore = Infinity; // AI plays black = minimizing

        for (const mv of moves) {
          chess.move(mv);
          const rawScore = alphaBeta(chess, effectiveDepth - 1, -Infinity, Infinity, true);
          chess.undo();
          const score = addNoise(rawScore, skill);
          if (score < bestScore) { bestScore = score; bestMove = mv; }
        }

        if (!bestMove) { resolve(null); return; }
        resolve({ from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion || 'q' });
      } catch (err) {
        console.error('Engine error:', err);
        // Fallback: pick a random legal move
        const moves = chess?.moves({ verbose: true }) || [];
        if (moves.length) {
          const m = moves[Math.floor(Math.random() * moves.length)];
          resolve({ from: m.from, to: m.to, promotion: 'q' });
        } else resolve(null);
      }
    }, 10);
  });
}

// uciToMove kept for API compatibility (not needed with new engine but harmless)
export const uciToMove = uci => uci?.length >= 4
  ? { from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || 'q' }
  : null;

function aiPlayTurn() {
  return aiPlayTurn_02();
}

function aiPlayTurn_00() {
  const player = PLAYER2;

  // If no dice yet, roll them
  if (diceMoves.length === 0) {
    rollDice();
    drawBoard();
  }

  // If still no moves possible, end turn
  if (!hasMoves(player)) {
    endTurnIfNeeded();
    return;
  }

  // Keep trying moves while dice remain and moves exist
  while (diceMoves.length > 0 && hasMoves(player)) {
    // 1. If on the bar, must enter
    if (bar[player] > 0) {
      let moved = false;
      for (const die of [...diceMoves]) {
        if (canEnterFromBar(player, die)) {
          const dest = entryPoint(player, die);
          attemptMoveFromBar(dest);
          moved = true;
          break;
        }
      }
      if (!moved) break; // no bar entry possible, end AI move loop
      continue;
    }

    // 2. Otherwise, try moves from points
    let moved = false;
    for (let i = 0; i < POINTS && !moved; i++) {
      if (board[i].player !== player || board[i].count === 0) continue;

      for (const die of [...diceMoves]) {
        if (!canMoveFromPoint(player, i, die)) continue;

        const dest = destinationPoint(player, i, die);
        if (dest === 'bear') {
          if (canBearOff(player, i, die)) {
            attemptMoveFromPoint(i, i); // bear off via attemptMoveFromPoint
            moved = true;
            break;
          }
        } else {
          attemptMoveFromPoint(i, dest);
          moved = true;
          break;
        }
      }
    }

    if (!moved) break; // no legal move found for remaining dice
  }

  drawBoard();
  updateStatus();
}

function aiPlayTurn_01() {
  const player = PLAYER2;

  // Auto-roll if needed
  if (diceMoves.length === 0) {
    rollDice();
    drawBoard();
  }

  // If no moves possible, end turn
  if (!hasMoves(player)) {
    endTurnIfNeeded();
    return;
  }

  // Helper: evaluate move priority
  function scoreMove(fromIndex, destIndex, die) {
    let score = 0;

    // 1. Prefer captures
    const p = board[destIndex];
    if (p.player === -player && p.count === 1) {
      score += 1000; // huge priority
    }

    // 2. Prefer doubling up singles (making points)
    if (p.player === player && p.count === 1) {
      score += 200;
    }

    // 3. Prefer moving from the back (farthest from bear-off)
    // PLAYER2 moves 0 → 23
    score += fromIndex * 2;

    return score;
  }

  // Try moves while dice remain
  while (diceMoves.length > 0 && hasMoves(player)) {

    // 1. If on the bar, must enter
    if (bar[player] > 0) {
      let bestDie = null;
      let bestScore = -Infinity;

      for (const die of diceMoves) {
        if (!canEnterFromBar(player, die)) continue;
        const dest = entryPoint(player, die);

        // Score bar entry (captures only)
        const p = board[dest];
        let score = 0;
        if (p.player === -player && p.count === 1) score += 1000;

        if (score > bestScore) {
          bestScore = score;
          bestDie = die;
        }
      }

      if (bestDie != null) {
        const dest = entryPoint(player, bestDie);
        attemptMoveFromBar(dest);
        continue;
      }

      break; // no bar entry possible
    }

    // 2. Evaluate all possible moves
    let bestMove = null;
    let bestScore = -Infinity;

    for (let i = 0; i < POINTS; i++) {
      if (board[i].player !== player || board[i].count === 0) continue;

      for (const die of diceMoves) {
        if (!canMoveFromPoint(player, i, die)) continue;

        const dest = destinationPoint(player, i, die);

        if (dest === 'bear') {
          if (canBearOff(player, i, die)) {
            // Bearing off is good but not as good as hitting
            const score = 500 + i; // prefer bearing off from back
            if (score > bestScore) {
              bestScore = score;
              bestMove = { from: i, dest: i, die };
            }
          }
          continue;
        }

        const score = scoreMove(i, dest, die);
        if (score > bestScore) {
          bestScore = score;
          bestMove = { from: i, dest, die };
        }
      }
    }

    // Execute best move
    if (bestMove) {
      attemptMoveFromPoint(bestMove.from, bestMove.dest);
      continue;
    }

    break; // no legal moves for remaining dice
  }

  drawBoard();
  updateStatus();
}

function aiPlayTurn_02() {
  const player = PLAYER2;

  // If no dice or no moves, AI does nothing
  if (diceMoves.length === 0 || !hasMoves(player)) {
    return;
  }

  function scoreMove(fromIndex, destIndex, die) {
    let score = 0;

    // Prefer captures
    const p = board[destIndex];
    if (p.player === -player && p.count === 1) {
      score += 1000;
    }

    // Prefer doubling up singles (making points)
    if (p.player === player && p.count === 1) {
      score += 200;
    }

    // Prefer moving from the back (farthest from bear-off)
    score += fromIndex * 2;

    return score;
  }

  while (diceMoves.length > 0 && hasMoves(player)) {
    // 1. Bar entry if needed
    if (bar[player] > 0) {
      let bestDie = null;
      let bestScore = -Infinity;

      for (const die of diceMoves) {
        if (!canEnterFromBar(player, die)) continue;
        const dest = entryPoint(player, die);
        const p = board[dest];
        let score = 0;
        if (p.player === -player && p.count === 1) score += 1000;

        if (score > bestScore) {
          bestScore = score;
          bestDie = die;
        }
      }

      if (bestDie != null) {
        const dest = entryPoint(player, bestDie);
        attemptMoveFromBar(dest); // this will internally call endTurnIfNeeded when needed
        continue;
      }

      break;
    }

    // 2. Choose best move from points
    let bestMove = null;
    let bestScore = -Infinity;

    for (let i = 0; i < POINTS; i++) {
      if (board[i].player !== player || board[i].count === 0) continue;

      for (const die of diceMoves) {
        if (!canMoveFromPoint(player, i, die)) continue;

        const dest = destinationPoint(player, i, die);

        if (dest === 'bear') {
          if (canBearOff(player, i, die)) {
            const score = 500 + i;
            if (score > bestScore) {
              bestScore = score;
              bestMove = { from: i, dest: i, die };
            }
          }
          continue;
        }

        const score = scoreMove(i, dest, die);
        if (score > bestScore) {
          bestScore = score;
          bestMove = { from: i, dest, die };
        }
      }
    }

    if (bestMove) {
      attemptMoveFromPoint(bestMove.from, bestMove.dest); // also calls endTurnIfNeeded when dice exhausted
      continue;
    }

    break;
  }

  drawBoard();
  updateStatus();
}


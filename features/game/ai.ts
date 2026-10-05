import {
  DELTA,
  cellIndex,
  isBlocked,
  type Bike,
  type Direction,
  type Game,
} from "./engine";

const LEFT_OF: Record<Direction, Direction> = {
  up: "left",
  left: "down",
  down: "right",
  right: "up",
};
const RIGHT_OF: Record<Direction, Direction> = {
  up: "right",
  right: "down",
  down: "left",
  left: "up",
};

const BASE_MISTAKE_RATE = 0.06;
const MIN_MISTAKE_RATE = 0.01;
const MISTAKE_RATE_PER_STAGE = 0.01;

// どれだけ先の壁まで気にするか。ステージが進むほど早めに曲がるようになる
function lookahead(stage: number): number {
  return 2 + stage * 2;
}

function mistakeRate(stage: number): number {
  return Math.max(MIN_MISTAKE_RATE, BASE_MISTAKE_RATE - (stage - 1) * MISTAKE_RATE_PER_STAGE);
}

// (x, y) から到達できる空きマスの数（flood fill）
function reachableArea(game: Game, startX: number, startY: number): number {
  const visited = new Uint8Array(game.cells.length);
  const stack = [cellIndex(game, startX, startY)];
  visited[stack[0]] = 1;
  let area = 0;
  while (stack.length > 0) {
    const index = stack.pop()!;
    area += 1;
    const x = index % game.cols;
    const y = (index - x) / game.cols;
    for (const { dx, dy } of Object.values(DELTA)) {
      const nx = x + dx;
      const ny = y + dy;
      if (isBlocked(game, nx, ny)) continue;
      const next = cellIndex(game, nx, ny);
      if (visited[next]) continue;
      visited[next] = 1;
      stack.push(next);
    }
  }
  return area;
}

// dir 方向にまっすぐ進める距離（limit で打ち切り）
function freeRun(game: Game, x: number, y: number, dir: Direction, limit: number): number {
  const { dx, dy } = DELTA[dir];
  let run = 0;
  while (run < limit && !isBlocked(game, x + dx * (run + 1), y + dy * (run + 1))) {
    run += 1;
  }
  return run;
}

export function chooseDirection(
  game: Game,
  bike: Bike,
  random: () => number = Math.random,
): Direction {
  // 直進を先頭に置き、評価が同点なら直進を選ぶ
  const candidates = [bike.dir, LEFT_OF[bike.dir], RIGHT_OF[bike.dir]].filter((dir) => {
    const { dx, dy } = DELTA[dir];
    return !isBlocked(game, bike.x + dx, bike.y + dy);
  });
  if (candidates.length === 0) return bike.dir;

  if (random() < mistakeRate(game.stage)) {
    return candidates[Math.floor(random() * candidates.length)];
  }

  const limit = lookahead(game.stage);
  let best = candidates[0];
  let bestScore = -1;
  for (const dir of candidates) {
    const { dx, dy } = DELTA[dir];
    const x = bike.x + dx;
    const y = bike.y + dy;
    // 広い空間に出られることを最優先し、同じ広さなら先が詰まっていない方を選ぶ
    const score = reachableArea(game, x, y) * (limit + 1) + freeRun(game, x, y, dir, limit);
    if (score > bestScore) {
      best = dir;
      bestScore = score;
    }
  }
  return best;
}

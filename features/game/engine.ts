export const COLS = 80;
export const ROWS = 50;

export type Direction = "up" | "down" | "left" | "right";
export type BikeId = "player" | "cpu";
export type Phase = "ready" | "running" | "over";
export type Result = "win" | "lose" | "draw";

export type Bike = {
  id: BikeId;
  x: number;
  y: number;
  dir: Direction;
  nextDir: Direction;
  alive: boolean;
};

export type Game = {
  cols: number;
  rows: number;
  // 0 = 空き, それ以外は CELL[BikeId] の軌跡
  cells: Uint8Array;
  bikes: Bike[];
  phase: Phase;
  result: Result | null;
  stage: number;
  ticks: number;
  boostsLeft: number;
  // ブースト開始からの経過時間。null はブーストしていない
  boostElapsedMs: number | null;
};

export const CELL: Record<BikeId, number> = { player: 1, cpu: 2 };

export const DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const WIN_SCORE = 1000;
const BONUS_TICKS = 600;
const BASE_TICK_MS = 70;
const MIN_TICK_MS = 35;
const TICK_MS_PER_STAGE = 5;

export const MAX_BOOSTS = 3;
const BOOST_MS = 2000;
const BOOST_RAMP_UP_MS = 300;
const BOOST_RAMP_DOWN_MS = 500;
const BOOST_MULTIPLIER = 2;

// ステージが進むほど 1 tick が短くなる（= 速くなる）
export function tickMs(stage: number): number {
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - (stage - 1) * TICK_MS_PER_STAGE);
}

// 1勝ごとの得点。早く決着をつけるほどボーナスが大きい
export function stageScore(ticks: number): number {
  return WIN_SCORE + Math.max(0, BONUS_TICKS - ticks);
}

// stage で負けた時点で取りうる最高得点（サーバー側で申告スコアの妥当性を確かめるのに使う）
export function maxScoreAtStage(stage: number): number {
  return (stage - 1) * stageScore(0);
}

export function cellIndex(game: Game, x: number, y: number): number {
  return y * game.cols + x;
}

export function isBlocked(game: Game, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= game.cols || y >= game.rows) return true;
  return game.cells[cellIndex(game, x, y)] !== 0;
}

export function createGame(stage = 1, boostsLeft = MAX_BOOSTS): Game {
  const y = Math.floor(ROWS / 2);
  const game: Game = {
    cols: COLS,
    rows: ROWS,
    cells: new Uint8Array(COLS * ROWS),
    bikes: [
      { id: "player", x: Math.floor(COLS / 4), y, dir: "right", nextDir: "right", alive: true },
      { id: "cpu", x: Math.floor((COLS * 3) / 4), y, dir: "left", nextDir: "left", alive: true },
    ],
    phase: "ready",
    result: null,
    stage,
    ticks: 0,
    boostsLeft,
    boostElapsedMs: null,
  };
  for (const bike of game.bikes) {
    game.cells[cellIndex(game, bike.x, bike.y)] = CELL[bike.id];
  }
  return game;
}

export function getBike(game: Game, id: BikeId): Bike | undefined {
  return game.bikes.find((bike) => bike.id === id);
}

// 1 tick の間に何度キーを押しても、いま進んでいる向きの真逆には曲がれない
export function turn(bike: Bike, dir: Direction): void {
  if (dir === OPPOSITE[bike.dir]) return;
  bike.nextDir = dir;
}

// ブーストは同時に1つだけ。重ねがけはできず、押しても残数は減らない
export function activateBoost(game: Game): boolean {
  if (game.phase !== "running" || game.boostsLeft <= 0 || game.boostElapsedMs !== null) {
    return false;
  }
  game.boostsLeft -= 1;
  game.boostElapsedMs = 0;
  return true;
}

export function advanceBoost(game: Game, dtMs: number): void {
  if (game.phase !== "running" || game.boostElapsedMs === null) return;
  game.boostElapsedMs += dtMs;
  if (game.boostElapsedMs >= BOOST_MS) game.boostElapsedMs = null;
}

// 自機の速度倍率。グインと立ち上がり、最後はなめらかに 1 へ戻る
export function boostMultiplier(game: Game): number {
  const elapsed = game.boostElapsedMs;
  if (elapsed === null) return 1;
  const extra = BOOST_MULTIPLIER - 1;
  if (elapsed < BOOST_RAMP_UP_MS) {
    const t = elapsed / BOOST_RAMP_UP_MS;
    return 1 + extra * (1 - (1 - t) ** 3);
  }
  const rampDownStart = BOOST_MS - BOOST_RAMP_DOWN_MS;
  if (elapsed < rampDownStart) return BOOST_MULTIPLIER;
  const t = Math.min(1, (elapsed - rampDownStart) / BOOST_RAMP_DOWN_MS);
  const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  return BOOST_MULTIPLIER - extra * eased;
}

function moveBikes(game: Game, bikes: Bike[]): void {
  // 全員の移動先を先に決めてから判定する（順番に動かすと先に動いた側が有利になる）
  const moves = bikes.map((bike) => {
    bike.dir = bike.nextDir;
    const { dx, dy } = DELTA[bike.dir];
    return { bike, x: bike.x + dx, y: bike.y + dy };
  });

  for (const move of moves) {
    const headOn = moves.some(
      (other) => other !== move && other.x === move.x && other.y === move.y,
    );
    if (headOn || isBlocked(game, move.x, move.y)) {
      move.bike.alive = false;
    }
  }

  for (const { bike, x, y } of moves) {
    if (!bike.alive) continue;
    bike.x = x;
    bike.y = y;
    game.cells[cellIndex(game, x, y)] = CELL[bike.id];
  }
}

function settle(game: Game): void {
  const playerAlive = getBike(game, "player")?.alive ?? false;
  const cpuAlive = getBike(game, "cpu")?.alive ?? false;
  if (playerAlive && cpuAlive) return;

  game.phase = "over";
  if (playerAlive) game.result = "win";
  else if (cpuAlive) game.result = "lose";
  else game.result = "draw";
}

export function step(game: Game): void {
  if (game.phase !== "running") return;
  moveBikes(
    game,
    game.bikes.filter((bike) => bike.alive),
  );
  game.ticks += 1;
  settle(game);
}

// ブースト中に自機だけを追加で 1 マス進める。ticks は増やさない（スコアの早解きボーナスに影響させない）
export function boostStep(game: Game): void {
  if (game.phase !== "running") return;
  const player = getBike(game, "player");
  if (!player?.alive) return;
  moveBikes(game, [player]);
  settle(game);
}

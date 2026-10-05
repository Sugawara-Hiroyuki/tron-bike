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

// ステージが進むほど 1 tick が短くなる（= 速くなる）
export function tickMs(stage: number): number {
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - (stage - 1) * TICK_MS_PER_STAGE);
}

// 1勝ごとの得点。早く決着をつけるほどボーナスが大きい
export function stageScore(ticks: number): number {
  return WIN_SCORE + Math.max(0, BONUS_TICKS - ticks);
}

export function cellIndex(game: Game, x: number, y: number): number {
  return y * game.cols + x;
}

export function isBlocked(game: Game, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= game.cols || y >= game.rows) return true;
  return game.cells[cellIndex(game, x, y)] !== 0;
}

export function createGame(stage = 1): Game {
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

export function step(game: Game): void {
  if (game.phase !== "running") return;

  // 全員の移動先を先に決めてから判定する（順番に動かすと先に動いた側が有利になる）
  const moves = game.bikes
    .filter((bike) => bike.alive)
    .map((bike) => {
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

  game.ticks += 1;

  const playerAlive = getBike(game, "player")?.alive ?? false;
  const cpuAlive = getBike(game, "cpu")?.alive ?? false;
  if (playerAlive && cpuAlive) return;

  game.phase = "over";
  if (playerAlive) game.result = "win";
  else if (cpuAlive) game.result = "lose";
  else game.result = "draw";
}

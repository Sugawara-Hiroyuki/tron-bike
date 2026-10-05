export const COLS = 80;
export const ROWS = 50;

export type Direction = "up" | "down" | "left" | "right";
export type BikeId = "player" | "cpu";
export type Phase = "ready" | "running" | "over";

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
  ticks: number;
};

export const CELL: Record<BikeId, number> = { player: 1, cpu: 2 };

export const DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function cellIndex(game: Game, x: number, y: number): number {
  return y * game.cols + x;
}

export function isBlocked(game: Game, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= game.cols || y >= game.rows) return true;
  return game.cells[cellIndex(game, x, y)] !== 0;
}

export function createGame(): Game {
  const game: Game = {
    cols: COLS,
    rows: ROWS,
    cells: new Uint8Array(COLS * ROWS),
    bikes: [
      {
        id: "player",
        x: Math.floor(COLS / 4),
        y: Math.floor(ROWS / 2),
        dir: "right",
        nextDir: "right",
        alive: true,
      },
    ],
    phase: "ready",
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

  for (const bike of game.bikes) {
    if (!bike.alive) continue;
    bike.dir = bike.nextDir;
    const { dx, dy } = DELTA[bike.dir];
    const x = bike.x + dx;
    const y = bike.y + dy;
    if (isBlocked(game, x, y)) {
      bike.alive = false;
      continue;
    }
    bike.x = x;
    bike.y = y;
    game.cells[cellIndex(game, x, y)] = CELL[bike.id];
  }

  game.ticks += 1;
  if (game.bikes.some((bike) => !bike.alive)) {
    game.phase = "over";
  }
}

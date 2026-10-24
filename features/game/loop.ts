import { advanceBoost, boostMultiplier, boostStep, step, tickMs, type BikeId, type Game } from "./engine";

// 固定 tick で進めるための、まだ消化していない時間の溜まり
export type Clock = {
  tick: number;
  boost: Record<BikeId, number>;
};

export function createClock(): Clock {
  return { tick: 0, boost: { player: 0, cpu: 0 } };
}

// 経過時間 dtMs ぶんゲームを進める。beforeStep は毎 tick の移動直前に呼ばれる（CPU の思考など）
export function advance(
  game: Game,
  clock: Clock,
  dtMs: number,
  beforeStep?: (game: Game) => void,
): void {
  clock.tick += dtMs;
  const interval = tickMs(game.stage);
  while (clock.tick >= interval) {
    if (game.phase === "running") beforeStep?.(game);
    step(game);
    clock.tick -= interval;
  }
  // 倍率が 1 を超えたぶんだけ、ブースト中のバイクを追加で進める
  for (const bike of game.bikes) {
    clock.boost[bike.id] += dtMs * (boostMultiplier(bike) - 1);
  }
  advanceBoost(game, dtMs);
  for (const bike of game.bikes) {
    while (clock.boost[bike.id] >= interval) {
      boostStep(game, bike);
      clock.boost[bike.id] -= interval;
    }
    if (bike.boostElapsedMs === null) clock.boost[bike.id] = 0;
  }
}

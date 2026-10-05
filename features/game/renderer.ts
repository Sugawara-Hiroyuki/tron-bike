import { CELL, type BikeId, type Game } from "./engine";

export const CELL_SIZE = 12;

const COLORS: Record<BikeId, string> = {
  player: "#22e3ff",
  cpu: "#ff8a1f",
};
const BACKGROUND = "#02040a";
const GRID = "#0b2a3a";
const GRID_EVERY = 5;

export function draw(ctx: CanvasRenderingContext2D, game: Game): void {
  const width = game.cols * CELL_SIZE;
  const height = game.rows * CELL_SIZE;

  ctx.shadowBlur = 0;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= game.cols; x += GRID_EVERY) {
    ctx.moveTo(x * CELL_SIZE + 0.5, 0);
    ctx.lineTo(x * CELL_SIZE + 0.5, height);
  }
  for (let y = 0; y <= game.rows; y += GRID_EVERY) {
    ctx.moveTo(0, y * CELL_SIZE + 0.5);
    ctx.lineTo(width, y * CELL_SIZE + 0.5);
  }
  ctx.stroke();

  for (const bike of game.bikes) {
    const color = COLORS[bike.id];
    const cell = CELL[bike.id];

    // 軌跡は1つのパスにまとめ、発光(shadowBlur)の計算を1回の fill で済ませる
    ctx.beginPath();
    for (let y = 0; y < game.rows; y++) {
      for (let x = 0; x < game.cols; x++) {
        if (game.cells[y * game.cols + x] === cell) {
          ctx.rect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        }
      }
    }
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 20;
    ctx.fillStyle = bike.alive ? "#ffffff" : color;
    ctx.fillRect(bike.x * CELL_SIZE, bike.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }
  ctx.shadowBlur = 0;
}

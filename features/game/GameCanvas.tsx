"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLS,
  ROWS,
  createGame,
  getBike,
  step,
  turn,
  type Direction,
  type Phase,
} from "./engine";
import { CELL_SIZE, draw } from "./renderer";

const WIDTH = COLS * CELL_SIZE;
const HEIGHT = ROWS * CELL_SIZE;
const TICK_MS = 60;
// タブが裏に回って戻ったときに、溜まった時間ぶん一気に進まないようにする上限
const MAX_FRAME_MS = 250;

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const MESSAGES: Record<Exclude<Phase, "running">, string> = {
  ready: "PRESS SPACE TO START",
  over: "GAME OVER — PRESS SPACE",
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ゲーム状態は毎フレーム書き換わるので React の state には載せず、effect 内に閉じ込める
    let game = createGame();
    let shownPhase: Phase = game.phase;
    let accumulator = 0;
    let last = performance.now();
    let frameId = 0;

    const syncPhase = () => {
      if (game.phase === shownPhase) return;
      shownPhase = game.phase;
      setPhase(shownPhase);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        if (game.phase === "over") game = createGame();
        if (game.phase === "ready") {
          game.phase = "running";
          accumulator = 0;
        }
        syncPhase();
        return;
      }
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) return;
      event.preventDefault();
      const player = getBike(game, "player");
      if (player) turn(player, direction);
    };

    const frame = (now: number) => {
      accumulator += Math.min(now - last, MAX_FRAME_MS);
      last = now;
      while (accumulator >= TICK_MS) {
        step(game);
        accumulator -= TICK_MS;
      }
      syncPhase();
      draw(ctx, game);
      frameId = requestAnimationFrame(frame);
    };

    window.addEventListener("keydown", onKeyDown);
    frameId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="relative w-full max-w-[960px]">
      <canvas
        ref={canvasRef}
        className="neon-box block h-auto w-full border border-player text-player"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      />
      {phase !== "running" && (
        <p className="neon-text pointer-events-none absolute inset-0 flex items-center justify-center text-center text-lg tracking-widest text-player">
          {MESSAGES[phase]}
        </p>
      )}
    </div>
  );
}

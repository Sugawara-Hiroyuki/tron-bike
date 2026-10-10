"use client";

import { useEffect, useRef, useState } from "react";
import { chooseDirection } from "./ai";
import {
  COLS,
  MAX_BOOSTS,
  ROWS,
  activateBoost,
  advanceBoost,
  boostMultiplier,
  boostStep,
  createGame,
  getBike,
  stageScore,
  step,
  tickMs,
  turn,
  type Direction,
  type Phase,
  type Result,
} from "./engine";
import { CELL_SIZE, draw } from "./renderer";
import ScoreForm from "./ScoreForm";

const WIDTH = COLS * CELL_SIZE;
const HEIGHT = ROWS * CELL_SIZE;
// タブが裏に回って戻ったときに、溜まった時間ぶん一気に進まないようにする上限
const MAX_FRAME_MS = 250;
// 決着の直後は SPACE を受け付けない（ブーストの押下で結果画面を飛ばしてしまうのを防ぐ）
const RESTART_GUARD_MS = 600;

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

const RESULT_MESSAGES: Record<Result, { title: string; hint: string; color: string }> = {
  win: { title: "YOU WIN", hint: "SPACE で次のステージへ", color: "text-player" },
  lose: { title: "GAME OVER", hint: "SPACE でもう一度", color: "text-cpu" },
  draw: { title: "DRAW", hint: "SPACE で再戦", color: "text-foreground" },
};

// 画面に出す値だけを React の state にする
type Hud = {
  phase: Phase;
  result: Result | null;
  stage: number;
  score: number;
  boosts: number;
};

const INITIAL_HUD: Hud = {
  phase: "ready",
  result: null,
  stage: 1,
  score: 0,
  boosts: MAX_BOOSTS,
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);

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
    let score = 0;
    let shownPhase: Phase = game.phase;
    let shownBoosts = game.boostsLeft;
    // 別ページから戻ると React の state だけ前回の値で残るので、最初のフレームで必ず HUD を合わせ直す
    let hudSynced = false;
    let overAt = 0;
    let accumulator = 0;
    let boostAccumulator = 0;
    let last = performance.now();
    let frameId = 0;

    const syncHud = () => {
      if (hudSynced && game.phase === shownPhase && game.boostsLeft === shownBoosts) return;
      hudSynced = true;
      if (game.phase !== shownPhase && game.phase === "over") {
        overAt = performance.now();
        if (game.result === "win") score += stageScore(game.ticks);
      }
      shownPhase = game.phase;
      shownBoosts = game.boostsLeft;
      setHud({
        phase: game.phase,
        result: game.result,
        stage: game.stage,
        score,
        boosts: game.boostsLeft,
      });
    };

    const startNextRound = () => {
      if (game.result === "lose") score = 0;
      const stage =
        game.result === "win" ? game.stage + 1 : game.result === "lose" ? 1 : game.stage;
      // ブーストの残数は負けるまで持ち越す
      game = createGame(stage, game.result === "lose" ? MAX_BOOSTS : game.boostsLeft);
      game.phase = "running";
      accumulator = 0;
      boostAccumulator = 0;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // 名前入力中のキー（スペースや WASD）をゲーム操作として拾わない
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === " ") {
        event.preventDefault();
        if (event.repeat) return;
        if (game.phase === "running") {
          activateBoost(game);
          syncHud();
          return;
        }
        if (game.phase === "over" && performance.now() - overAt < RESTART_GUARD_MS) return;
        startNextRound();
        syncHud();
        return;
      }
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) return;
      event.preventDefault();
      const player = getBike(game, "player");
      if (player) turn(player, direction);
    };

    const frame = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_MS);
      accumulator += dt;
      last = now;
      const interval = tickMs(game.stage);
      while (accumulator >= interval) {
        const cpu = getBike(game, "cpu");
        if (cpu && game.phase === "running") turn(cpu, chooseDirection(game, cpu));
        step(game);
        accumulator -= interval;
      }
      // 倍率が 1 を超えたぶんだけ、自機を追加で進める
      boostAccumulator += dt * (boostMultiplier(game) - 1);
      advanceBoost(game, dt);
      while (boostAccumulator >= interval) {
        boostStep(game);
        boostAccumulator -= interval;
      }
      if (game.boostElapsedMs === null) boostAccumulator = 0;
      syncHud();
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

  const message = hud.result ? RESULT_MESSAGES[hud.result] : null;

  return (
    <div className="flex w-full max-w-[960px] flex-col gap-3">
      <div className="flex justify-between text-sm tracking-widest">
        <span className="text-player">STAGE {hud.stage}</span>
        <span className="flex items-center gap-2 text-player">
          BOOST
          {Array.from({ length: MAX_BOOSTS }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-4 border border-player ${i < hud.boosts ? "bg-player" : ""}`}
            />
          ))}
        </span>
        <span className="font-mono text-foreground">SCORE {hud.score}</span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="neon-box block h-auto w-full border border-player text-player"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        />
        {hud.phase === "ready" && (
          <p className="neon-text pointer-events-none absolute inset-0 flex items-center justify-center text-lg tracking-widest text-player">
            PRESS SPACE TO START
          </p>
        )}
        {hud.phase === "over" && message && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 ${message.color}`}
          >
            <p className="neon-text text-4xl font-black tracking-[0.2em]">{message.title}</p>
            <p className="text-sm tracking-widest">{message.hint}</p>
            {hud.result === "lose" && hud.score > 0 && (
              <ScoreForm score={hud.score} stage={hud.stage} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

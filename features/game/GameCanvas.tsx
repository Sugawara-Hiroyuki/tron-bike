"use client";

import { useEffect, useRef, useState } from "react";
import { chooseDirection } from "./ai";
import {
  COLS,
  MAX_BOOSTS,
  ROWS,
  activateBoost,
  createGame,
  getBike,
  stageScore,
  turn,
  type Phase,
  type Result,
} from "./engine";
import { advance, createClock } from "./loop";
import { CELL_SIZE, draw } from "./renderer";
import ScoreForm from "./ScoreForm";
import TouchControls from "./TouchControls";
import { NOOP_HANDLERS, useGameControls, type ControlHandlers } from "./useGameControls";

const WIDTH = COLS * CELL_SIZE;
const HEIGHT = ROWS * CELL_SIZE;
// タブが裏に回って戻ったときに、溜まった時間ぶん一気に進まないようにする上限
const MAX_FRAME_MS = 250;
// 決着の直後は SPACE を受け付けない（ブーストの押下で結果画面を飛ばしてしまうのを防ぐ）
const RESTART_GUARD_MS = 600;
// hint の前には、キーボードなら「SPACE」、タッチ操作なら「タップ」を付けて表示する
const RESULT_MESSAGES: Record<Result, { title: string; hint: string; color: string }> = {
  win: { title: "YOU WIN", hint: "で次のステージへ", color: "text-player" },
  lose: { title: "GAME OVER", hint: "でもう一度", color: "text-cpu" },
  draw: { title: "DRAW", hint: "で再戦", color: "text-foreground" },
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
  const touchAreaRef = useRef<HTMLDivElement>(null);
  // 操作（キーボード・タッチ・ボタン）から effect 内のゲームを操作するための橋渡し
  const handlersRef = useRef<ControlHandlers>(NOOP_HANDLERS);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  useGameControls(touchAreaRef, handlersRef);

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
    let player = getBike(game, "player")!;
    let score = 0;
    let shownPhase: Phase = game.phase;
    let shownBoosts = player.boostsLeft;
    // 別ページから戻ると React の state だけ前回の値で残るので、最初のフレームで必ず HUD を合わせ直す
    let hudSynced = false;
    let overAt = 0;
    let clock = createClock();
    let last = performance.now();
    let frameId = 0;

    const syncHud = () => {
      if (hudSynced && game.phase === shownPhase && player.boostsLeft === shownBoosts) return;
      hudSynced = true;
      if (game.phase !== shownPhase && game.phase === "over") {
        overAt = performance.now();
        if (game.result === "win") score += stageScore(game.ticks);
      }
      shownPhase = game.phase;
      shownBoosts = player.boostsLeft;
      setHud({
        phase: game.phase,
        result: game.result,
        stage: game.stage,
        score,
        boosts: player.boostsLeft,
      });
    };

    const startNextRound = () => {
      if (game.result === "lose") score = 0;
      const stage =
        game.result === "win" ? game.stage + 1 : game.result === "lose" ? 1 : game.stage;
      // ブーストの残数は負けるまで持ち越す
      game = createGame(stage, {
        player: game.result === "lose" ? MAX_BOOSTS : player.boostsLeft,
      });
      player = getBike(game, "player")!;
      game.phase = "running";
      clock = createClock();
    };

    const boost = () => {
      activateBoost(game, player);
      syncHud();
    };

    // 走行中でなければ、開始または次のラウンドへ進む
    const startIfIdle = () => {
      if (game.phase === "running") return;
      if (game.phase === "over" && performance.now() - overAt < RESTART_GUARD_MS) return;
      startNextRound();
      syncHud();
    };

    handlersRef.current = {
      turn: (direction) => turn(player, direction),
      boost,
      start: startIfIdle,
      isRunning: () => game.phase === "running",
    };

    const moveCpu = () => {
      const cpu = getBike(game, "cpu");
      if (cpu) turn(cpu, chooseDirection(game, cpu));
    };

    const frame = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_MS);
      last = now;
      advance(game, clock, dt, moveCpu);
      syncHud();
      draw(ctx, game);
      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);

    return () => {
      handlersRef.current = NOOP_HANDLERS;
      cancelAnimationFrame(frameId);
    };
  }, []);

  const message = hud.result ? RESULT_MESSAGES[hud.result] : null;

  return (
    // PC は縦一列。タッチ端末は横向きが基本で、プレイ画面の左に BOOST、右に方向ボタンを置く（縦向きではプレイ画面の下に並べる）。
    // touch-none はスワイプでページが動かないようにするため
    <div
      ref={touchAreaRef}
      className="flex w-full max-w-[min(960px,calc((100dvh_-_10rem)_*_1.6))] touch-none flex-col gap-3 pointer-coarse:grid pointer-coarse:grid-cols-2 pointer-coarse:items-center pointer-coarse:landscape:max-w-none pointer-coarse:landscape:grid-cols-[auto_minmax(0,1fr)_auto]"
    >
      {/* 横向きでは、画面の高さに収まるいちばん大きな幅まで広げる */}
      <div className="flex w-full flex-col gap-3 pointer-coarse:col-span-2 pointer-coarse:landscape:col-span-1 pointer-coarse:landscape:col-start-2 pointer-coarse:landscape:row-start-1 pointer-coarse:landscape:max-w-[calc((100dvh_-_4.5rem)_*_1.6)] pointer-coarse:landscape:gap-2 pointer-coarse:landscape:justify-self-center">
        <div className="flex justify-between text-xs tracking-widest select-none sm:text-sm">
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
            <p className="neon-text pointer-events-none absolute inset-0 flex items-center justify-center text-lg tracking-widest text-player select-none">
              <span className="pointer-coarse:hidden">PRESS SPACE TO START</span>
              <span className="hidden pointer-coarse:inline">TAP TO START</span>
            </p>
          )}
          {hud.phase === "over" && message && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 ${message.color}`}
            >
              <p className="neon-text text-2xl font-black tracking-[0.2em] sm:text-4xl">
                {message.title}
              </p>
              <p className="text-sm tracking-widest">
                <span className="pointer-coarse:hidden">SPACE </span>
                <span className="hidden pointer-coarse:inline">タップ</span>
                {message.hint}
              </p>
              {hud.result === "lose" && hud.score > 0 && (
                <ScoreForm score={hud.score} stage={hud.stage} />
              )}
            </div>
          )}
        </div>
      </div>
      {/* 以下はタッチ操作のときだけ出す。周りの余白はスワイプできる場所として残す */}
      <TouchControls
        handlersRef={handlersRef}
        boostDisabled={hud.phase !== "running" || hud.boosts === 0}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getAccepts, getServerAccepts, setAccepts, subscribeAccepts } from "@/features/online/accepts";
import { isOnlineEnabled } from "@/features/online/client";
import { entryCandidates, openLobby, randomId, type Lobby } from "@/features/online/lobby";
import {
  createVersusGuest,
  createVersusHost,
  type VersusEnd,
  type VersusSession,
  type VersusView,
} from "@/features/online/versus";
import { VersusHeader, VersusOverlay } from "@/features/online/VersusHud";
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
import {
  NOOP_HANDLERS,
  RESTART_GUARD_MS,
  useGameControls,
  type ControlHandlers,
} from "./useGameControls";

const WIDTH = COLS * CELL_SIZE;
const HEIGHT = ROWS * CELL_SIZE;
// タブが裏に回って戻ったときに、溜まった時間ぶん一気に進まないようにする上限
const MAX_FRAME_MS = 250;
// 乱入先が見つからない・申し込みに返事が来ないときは、あきらめて CPU 戦にする
const SEARCH_TIMEOUT_MS = 3000;
const REPLY_TIMEOUT_MS = 10_000;
const NOTICE_MS = 4000;

const CHALLENGER_NOTICE = "挑戦者が現れた！ このラウンドのあと対戦します";
const ENTRY_FAILED_NOTICES = {
  none: "乱入できる相手がいません。CPU と対戦します",
  busy: "先を越されました。CPU と対戦します",
};
const VERSUS_END_NOTICES: Record<VersusEnd, string | null> = {
  finished: null,
  disconnected: "相手が切断しました",
  timeout: "相手とつながりませんでした",
};

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
  // トップの ENTRY から来たか。最初の effect で URL から読む
  const entryRef = useRef<boolean | null>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  // 対戦中だけ値が入る
  const [versusView, setVersusView] = useState<VersusView | null>(null);
  const [entering, setEntering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const accepts = useSyncExternalStore(subscribeAccepts, getAccepts, getServerAccepts);
  const online = isOnlineEnabled();
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

    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const showNotice = (text: string | null, sticky = false) => {
      clearTimeout(noticeTimer);
      setNotice(text);
      if (text && !sticky) noticeTimer = setTimeout(() => setNotice(null), NOTICE_MS);
    };

    // オンライン対戦。CPU 戦の状態（game, score など）は対戦の間そのまま残し、終わったら続きから遊べるようにする
    const clientId = randomId();
    const since = Date.now();
    let lobby: Lobby | null = null;
    let versus: VersusSession | null = null;
    // 乱入を受けて、CPU 戦のラウンドが終わるのを待っている部屋
    let pendingRoomId: string | null = null;
    // 乱入する側: 申し込み中の相手
    let isEntering = false;
    let challengedTo: string | null = null;
    let replyTimer: ReturnType<typeof setTimeout> | undefined;
    let shownEntering = false;

    const trackLobby = () => {
      lobby?.track({
        clientId,
        since,
        accepts: getAccepts(),
        status:
          versus || pendingRoomId
            ? "versus"
            : isEntering
              ? "entry"
              : document.hidden
                ? "away"
                : "solo",
      });
    };

    const endVersus = (reason: VersusEnd) => {
      versus?.dispose();
      versus = null;
      setVersusView(null);
      showNotice(VERSUS_END_NOTICES[reason]);
      // CPU 戦の HUD を出し直す
      hudSynced = false;
      trackLobby();
    };

    const startVersus = (role: "host" | "guest", roomId: string) => {
      const create = role === "host" ? createVersusHost : createVersusGuest;
      versus = create({ roomId, onView: setVersusView, onEnd: endVersus });
      trackLobby();
    };

    const finishEntry = (reason: keyof typeof ENTRY_FAILED_NOTICES) => {
      clearTimeout(replyTimer);
      isEntering = false;
      showNotice(ENTRY_FAILED_NOTICES[reason]);
      trackLobby();
    };

    if (isOnlineEnabled()) {
      // トップの ENTRY から来たときは乱入する。リロードで再び乱入しないよう URL からは消しておく
      // （開発時は effect が 2 回走るので、1 回目に読んだ結果を ref に残す）
      if (entryRef.current === null) {
        entryRef.current = new URLSearchParams(location.search).get("entry") === "1";
        if (entryRef.current) history.replaceState(null, "", location.pathname);
      }
      isEntering = entryRef.current;
      if (isEntering) replyTimer = setTimeout(() => finishEntry("none"), SEARCH_TIMEOUT_MS);

      lobby = openLobby({
        onMembers: (members) => {
          if (!isEntering || challengedTo) return;
          // 顔ぶれは接続直後に何度か更新されるので、見つからなくてもしばらく待つ
          const target = entryCandidates(members, clientId)[0];
          if (!target) return;
          challengedTo = target.clientId;
          lobby?.challenge({ from: clientId, to: target.clientId });
          clearTimeout(replyTimer);
          replyTimer = setTimeout(() => finishEntry("busy"), REPLY_TIMEOUT_MS);
        },
        onChallenge: ({ from, to }) => {
          if (to !== clientId) return;
          // 受けるのは先着 1 人だけ
          const ok = getAccepts() && !document.hidden && !versus && !pendingRoomId && !isEntering;
          const roomId = ok ? randomId() : null;
          lobby?.reply({ from: clientId, to: from, ok, roomId });
          if (!roomId) return;
          pendingRoomId = roomId;
          showNotice(CHALLENGER_NOTICE, true);
          trackLobby();
        },
        onReply: ({ from, to, ok, roomId }) => {
          if (!isEntering || to !== clientId || from !== challengedTo) return;
          if (!ok || !roomId) {
            finishEntry("busy");
            return;
          }
          clearTimeout(replyTimer);
          isEntering = false;
          startVersus("guest", roomId);
        },
      });
      trackLobby();
    }
    const unsubscribeAccepts = subscribeAccepts(trackLobby);
    document.addEventListener("visibilitychange", trackLobby);

    // 走行中でなければ、開始または次のラウンドへ進む
    const startIfIdle = () => {
      if (game.phase === "running") return;
      if (game.phase === "over" && performance.now() - overAt < RESTART_GUARD_MS) return;
      startNextRound();
      syncHud();
    };

    // 対戦中は対戦の操作に回す。乱入先を探している間は CPU 戦を始めない
    handlersRef.current = {
      turn: (direction) => (versus ? versus.handlers.turn(direction) : turn(player, direction)),
      boost: () => (versus ? versus.handlers.boost() : boost()),
      start: () => {
        if (versus) versus.handlers.start();
        else if (!isEntering) startIfIdle();
      },
      isRunning: () => (versus ? versus.handlers.isRunning() : game.phase === "running"),
    };

    const moveCpu = () => {
      const cpu = getBike(game, "cpu");
      if (cpu) turn(cpu, chooseDirection(game, cpu));
    };

    const frame = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_MS);
      last = now;
      if (isEntering !== shownEntering) {
        shownEntering = isEntering;
        setEntering(isEntering);
      }
      versus?.frame(dt);
      if (versus) {
        draw(ctx, versus.game);
      } else {
        advance(game, clock, dt, moveCpu);
        syncHud();
        // 乱入を受けていたら、CPU 戦のラウンドが終わったところで対戦に切り替える
        if (pendingRoomId && game.phase !== "running") {
          const roomId = pendingRoomId;
          pendingRoomId = null;
          showNotice(null);
          startVersus("host", roomId);
        }
        draw(ctx, game);
      }
      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);

    return () => {
      handlersRef.current = NOOP_HANDLERS;
      cancelAnimationFrame(frameId);
      clearTimeout(noticeTimer);
      clearTimeout(replyTimer);
      unsubscribeAccepts();
      document.removeEventListener("visibilitychange", trackLobby);
      versus?.dispose();
      lobby?.close();
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
        {versusView ? (
          <VersusHeader view={versusView} />
        ) : (
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
            <span className="flex items-center gap-3">
              <span className="font-mono text-foreground">SCORE {hud.score}</span>
              {online && (
                <button
                  type="button"
                  aria-pressed={accepts}
                  title="ほかの人の乱入を受け付けるか"
                  onClick={(event) => {
                    setAccepts(!accepts);
                    // フォーカスが残ると、SPACE でこのボタンが押されてしまう
                    event.currentTarget.blur();
                  }}
                  className={`border px-1.5 text-[10px] tracking-widest sm:text-xs ${accepts ? "border-cpu text-cpu" : "border-foreground/40 text-foreground/40"}`}
                >
                  乱入 {accepts ? "OK" : "NG"}
                </button>
              )}
            </span>
          </div>
        )}
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="neon-box block h-auto w-full border border-player text-player"
            style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          />
          {versusView && <VersusOverlay view={versusView} />}
          {!versusView && hud.phase === "ready" && entering && (
            <p className="neon-text pointer-events-none absolute inset-0 flex items-center justify-center text-lg tracking-widest text-cpu select-none">
              SEARCHING FOR RIVAL…
            </p>
          )}
          {!versusView && hud.phase === "ready" && !entering && (
            <p className="neon-text pointer-events-none absolute inset-0 flex items-center justify-center text-lg tracking-widest text-player select-none">
              <span className="pointer-coarse:hidden">PRESS SPACE TO START</span>
              <span className="hidden pointer-coarse:inline">TAP TO START</span>
            </p>
          )}
          {!versusView && hud.phase === "over" && message && (
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
          {notice && (
            <p className="neon-text pointer-events-none absolute inset-x-0 top-3 text-center text-xs tracking-widest text-cpu select-none sm:text-sm">
              {notice}
            </p>
          )}
        </div>
      </div>
      {/* 以下はタッチ操作のときだけ出す。周りの余白はスワイプできる場所として残す */}
      <TouchControls
        handlersRef={handlersRef}
        boostDisabled={
          versusView
            ? versusView.phase !== "running" || versusView.boosts === 0
            : hud.phase !== "running" || hud.boosts === 0
        }
      />
    </div>
  );
}

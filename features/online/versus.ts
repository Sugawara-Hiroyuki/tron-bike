import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  activateBoost,
  advanceBoost,
  createGame,
  getBike,
  turn,
  type BikeId,
  type Game,
} from "@/features/game/engine";
import { advance, createClock } from "@/features/game/loop";
import { RESTART_GUARD_MS, type ControlHandlers } from "@/features/game/useGameControls";
import { getRealtime } from "./client";
import {
  applyDiff,
  decodeCells,
  diffCells,
  encodeCells,
  type BikeState,
  type InputMessage,
  type MatchState,
  type StateMessage,
} from "./protocol";

// 対戦の速度はステージ 1 で固定
const VERSUS_STAGE = 1;
export const WINS_TO_MATCH = 3;
const COUNTDOWN_MS = 3000;
// ホストは乱入を受けてから入るので、ゲストは CPU 戦のラウンドが終わるのを長めに待つ
const HOST_WAIT_MS = 15_000;
const GUEST_WAIT_MS = 60_000;
const SYNC_RETRY_MS = 1000;

// 乱入された側（ホスト）はシアンの player、乱入した側（ゲスト）はオレンジの cpu を操作する
const ROLE_OF: Record<"host" | "guest", BikeId> = { host: "player", guest: "cpu" };
const RIVAL_OF: Record<BikeId, BikeId> = { player: "cpu", cpu: "player" };

export type VersusEnd = "finished" | "disconnected" | "timeout";

export type VersusView = MatchState & {
  me: BikeId;
  // 相手が部屋に入って盤面がそろうまでは waiting
  status: "waiting" | "playing";
  phase: Game["phase"];
  boosts: number;
};

export type VersusSession = {
  // 描画に使う盤面。ラウンドごとに作り直すので、毎フレーム読み直す
  readonly game: Game;
  frame: (dtMs: number) => void;
  handlers: ControlHandlers;
  dispose: () => void;
};

type VersusOptions = {
  roomId: string;
  onView: (view: VersusView) => void;
  onEnd: (reason: VersusEnd) => void;
};

function openRoom(roomId: string, me: BikeId): RealtimeChannel {
  return getRealtime().channel(`room:${roomId}`, {
    config: { broadcast: { self: false }, presence: { key: me, enabled: true } },
  });
}

function toBikeState(game: Game): BikeState[] {
  return game.bikes.map(({ id, x, y, dir, alive, boostsLeft, boostElapsedMs }) => ({
    id,
    x,
    y,
    dir,
    alive,
    boostsLeft,
    boostElapsedMs,
  }));
}

// 変わったときだけ onView を呼ぶ（毎フレーム React の state を更新しないため）
function viewEmitter(onView: (view: VersusView) => void) {
  let last = "";
  return (view: VersusView) => {
    const key = JSON.stringify(view);
    if (key === last) return;
    last = key;
    onView(view);
  };
}

// 乱入された側。シミュレーションはこちらだけで回し、結果をゲストに送る
export function createVersusHost({ roomId, onView, onEnd }: VersusOptions): VersusSession {
  const me = ROLE_OF.host;
  const rival = RIVAL_OF[me];
  const channel = openRoom(roomId, me);
  const emitView = viewEmitter(onView);
  const openedAt = performance.now();

  let game = createGame(VERSUS_STAGE);
  let clock = createClock();
  const match: MatchState = {
    round: 0,
    wins: { player: 0, cpu: 0 },
    ready: { player: false, cpu: false },
    countdown: null,
    roundWinner: null,
    matchWinner: null,
  };
  let countdownEndsAt: number | null = null;
  let overAt = 0;
  let rivalJoined = false;
  let ended = false;
  let seq = 0;
  const sentCells = new Uint8Array(game.cells.length);
  let needFull = true;
  let lastSent = "";

  const end = (reason: VersusEnd) => {
    if (ended) return;
    ended = true;
    onEnd(reason);
  };

  const setReady = (id: BikeId) => {
    if (match.matchWinner || game.phase === "running" || countdownEndsAt !== null) return;
    if (game.phase === "over" && performance.now() - overAt < RESTART_GUARD_MS) return;
    match.ready[id] = true;
    if (!match.ready.player || !match.ready.cpu) return;
    // 盤面はカウントダウンの間に新しくしておく
    game = createGame(VERSUS_STAGE);
    clock = createClock();
    match.round += 1;
    match.roundWinner = null;
    countdownEndsAt = performance.now() + COUNTDOWN_MS;
  };

  const settleRound = () => {
    overAt = performance.now();
    const winner: BikeId | "draw" =
      game.result === "win" ? "player" : game.result === "lose" ? "cpu" : "draw";
    match.roundWinner = winner;
    if (winner !== "draw") {
      match.wins[winner] += 1;
      if (match.wins[winner] >= WINS_TO_MATCH) match.matchWinner = winner;
    }
  };

  const onInput = (input: InputMessage) => {
    const bike = getBike(game, rival);
    if (!bike) return;
    if (input.kind === "turn" && game.phase === "running") turn(bike, input.direction);
    else if (input.kind === "boost") activateBoost(game, bike);
    else if (input.kind === "ready") setReady(rival);
    else if (input.kind === "sync") needFull = true;
  };

  const broadcast = () => {
    if (!rivalJoined) return;
    const bikes = toBikeState(game);
    // ブースト中の経過時間は毎フレーム変わるので、変化の判定には「ブースト中かどうか」だけを使う（ゲストは手元で進める）
    const key = JSON.stringify([
      match,
      game.phase,
      game.result,
      bikes.map((b) => ({ ...b, boostElapsedMs: b.boostElapsedMs !== null })),
    ]);
    const diff = needFull ? null : diffCells(game.cells, sentCells);
    if (diff && diff.length === 0 && key === lastSent) return;
    lastSent = key;
    seq += 1;
    const message: StateMessage = {
      ...match,
      seq,
      phase: game.phase,
      result: game.result,
      bikes,
    };
    if (diff) {
      message.diff = diff;
    } else {
      sentCells.set(game.cells);
      message.cells = encodeCells(game.cells);
      needFull = false;
    }
    void channel.send({ type: "broadcast", event: "state", payload: message });
  };

  channel
    .on("broadcast", { event: "input" }, ({ payload }) => onInput(payload as InputMessage))
    .on("presence", { event: "sync" }, () => {
      const here = rival in channel.presenceState();
      if (here && !rivalJoined) {
        rivalJoined = true;
        needFull = true;
      } else if (!here && rivalJoined && !match.matchWinner) {
        end("disconnected");
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void channel.track({ joinedAt: Date.now() });
    });

  const frame = (dtMs: number) => {
    if (ended) return;
    const now = performance.now();
    if (!rivalJoined && now - openedAt > HOST_WAIT_MS) {
      end("timeout");
      return;
    }
    if (countdownEndsAt !== null) {
      if (now >= countdownEndsAt) {
        countdownEndsAt = null;
        match.countdown = null;
        match.ready = { player: false, cpu: false };
        game.phase = "running";
        clock = createClock();
      } else {
        match.countdown = Math.ceil((countdownEndsAt - now) / 1000);
      }
    }
    const wasRunning = game.phase === "running";
    advance(game, clock, dtMs);
    if (wasRunning && game.phase === "over") settleRound();
    broadcast();
    emitView({
      ...match,
      me,
      status: rivalJoined ? "playing" : "waiting",
      phase: game.phase,
      boosts: getBike(game, me)?.boostsLeft ?? 0,
    });
  };

  const handlers: ControlHandlers = {
    turn: (direction) => {
      const bike = getBike(game, me);
      if (bike && game.phase === "running") turn(bike, direction);
    },
    boost: () => {
      const bike = getBike(game, me);
      if (bike) activateBoost(game, bike);
    },
    start: () => {
      if (!match.matchWinner) {
        setReady(me);
      } else if (performance.now() - overAt >= RESTART_GUARD_MS) {
        end("finished");
      }
    },
    isRunning: () => game.phase === "running",
  };

  return {
    get game() {
      return game;
    },
    frame,
    handlers,
    dispose: () => {
      ended = true;
      void getRealtime().removeChannel(channel);
    },
  };
}

// 乱入した側。入力をホストに送り、届いた状態をそのまま描く
export function createVersusGuest({ roomId, onView, onEnd }: VersusOptions): VersusSession {
  const me = ROLE_OF.guest;
  const rival = RIVAL_OF[me];
  const channel = openRoom(roomId, me);
  const emitView = viewEmitter(onView);
  const openedAt = performance.now();

  const game = createGame(VERSUS_STAGE);
  let match: MatchState = {
    round: 0,
    wins: { player: 0, cpu: 0 },
    ready: { player: false, cpu: false },
    countdown: null,
    roundWinner: null,
    matchWinner: null,
  };
  let hostJoined = false;
  let synced = false;
  let lastSeq = 0;
  let syncRequestedAt = -Infinity;
  let overAt = 0;
  let ended = false;

  const end = (reason: VersusEnd) => {
    if (ended) return;
    ended = true;
    onEnd(reason);
  };

  const send = (input: InputMessage) => {
    void channel.send({ type: "broadcast", event: "input", payload: input });
  };

  const requestSync = () => {
    const now = performance.now();
    if (now - syncRequestedAt < SYNC_RETRY_MS) return;
    syncRequestedAt = now;
    send({ kind: "sync" });
  };

  const onState = (message: StateMessage) => {
    if (message.cells) {
      decodeCells(message.cells, game.cells);
      synced = true;
    } else if (!synced || message.seq !== lastSeq + 1 || !message.diff) {
      synced = false;
      requestSync();
      return;
    } else {
      applyDiff(game.cells, message.diff);
    }
    lastSeq = message.seq;
    for (const state of message.bikes) {
      const bike = getBike(game, state.id);
      if (bike) Object.assign(bike, state);
    }
    if (game.phase !== "over" && message.phase === "over") overAt = performance.now();
    game.phase = message.phase;
    game.result = message.result;
    const { round, wins, ready, countdown, roundWinner, matchWinner } = message;
    match = { round, wins, ready, countdown, roundWinner, matchWinner };
  };

  channel
    .on("broadcast", { event: "state" }, ({ payload }) => onState(payload as StateMessage))
    .on("presence", { event: "sync" }, () => {
      const here = rival in channel.presenceState();
      if (here) hostJoined = true;
      else if (hostJoined && !match.matchWinner) end("disconnected");
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void channel.track({ joinedAt: Date.now() });
    });

  const frame = (dtMs: number) => {
    if (ended) return;
    if (!hostJoined && performance.now() - openedAt > GUEST_WAIT_MS) {
      end("timeout");
      return;
    }
    // ブーストの光り方だけは、次の状態が届くまで手元で進めておく
    advanceBoost(game, dtMs);
    emitView({
      ...match,
      me,
      status: hostJoined && synced ? "playing" : "waiting",
      phase: game.phase,
      boosts: getBike(game, me)?.boostsLeft ?? 0,
    });
  };

  const handlers: ControlHandlers = {
    turn: (direction) => {
      if (game.phase === "running") send({ kind: "turn", direction });
    },
    boost: () => {
      if (game.phase === "running") send({ kind: "boost" });
    },
    start: () => {
      if (!match.matchWinner) {
        if (game.phase !== "running") send({ kind: "ready" });
      } else if (performance.now() - overAt >= RESTART_GUARD_MS) {
        end("finished");
      }
    },
    isRunning: () => game.phase === "running",
  };

  return {
    game,
    frame,
    handlers,
    dispose: () => {
      ended = true;
      void getRealtime().removeChannel(channel);
    },
  };
}

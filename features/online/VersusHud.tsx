import { MAX_BOOSTS, type BikeId } from "@/features/game/engine";
import { WINS_TO_MATCH, type VersusView } from "./versus";

const TEXT_COLOR: Record<BikeId, string> = { player: "text-player", cpu: "text-cpu" };
const BORDER_COLOR: Record<BikeId, string> = { player: "border-player", cpu: "border-cpu" };
const BG_COLOR: Record<BikeId, string> = { player: "bg-player", cpu: "bg-cpu" };

function rivalOf(me: BikeId): BikeId {
  return me === "player" ? "cpu" : "player";
}

// 対戦中のプレイ画面の上の行。自分の色で ROUND・勝ち数・ブースト残数を出す
export function VersusHeader({ view }: { view: VersusView }) {
  const rival = rivalOf(view.me);
  return (
    <div className="flex justify-between text-xs tracking-widest select-none sm:text-sm">
      <span className={TEXT_COLOR[view.me]}>ROUND {Math.max(1, view.round)}</span>
      <span className="font-mono">
        <span className={TEXT_COLOR[view.me]}>YOU {view.wins[view.me]}</span>
        <span className="text-foreground/60"> - </span>
        <span className={TEXT_COLOR[rival]}>{view.wins[rival]} RIVAL</span>
      </span>
      <span className={`flex items-center gap-2 ${TEXT_COLOR[view.me]}`}>
        BOOST
        {Array.from({ length: MAX_BOOSTS }, (_, i) => (
          <span
            key={i}
            className={`h-2 w-4 border ${BORDER_COLOR[view.me]} ${i < view.boosts ? BG_COLOR[view.me] : ""}`}
          />
        ))}
      </span>
    </div>
  );
}

function StartKey() {
  return (
    <>
      <span className="pointer-coarse:hidden">SPACE </span>
      <span className="hidden pointer-coarse:inline">タップ</span>
    </>
  );
}

// プレイ画面に重ねる表示。待機・カウントダウン・ラウンドと試合の結果
export function VersusOverlay({ view }: { view: VersusView }) {
  if (view.phase === "running") return null;
  const rival = rivalOf(view.me);

  if (view.status === "waiting") {
    return (
      <div className="neon-text pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 text-cpu select-none">
        <p className="text-lg tracking-widest">HERE COMES A NEW CHALLENGER!</p>
        <p className="text-xs tracking-widest text-foreground/70">相手とつないでいます…</p>
      </div>
    );
  }

  if (view.countdown !== null) {
    return (
      <p
        className={`neon-text pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-black select-none ${TEXT_COLOR[view.me]}`}
      >
        {view.countdown}
      </p>
    );
  }

  if (view.matchWinner) {
    const won = view.matchWinner === view.me;
    return (
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 select-none ${TEXT_COLOR[view.matchWinner]}`}
      >
        <p className="neon-text text-2xl font-black tracking-[0.2em] sm:text-4xl">
          {won ? "MATCH WIN" : "MATCH LOSE"}
        </p>
        <p className="text-sm tracking-widest">
          <StartKey />で CPU 戦へ
        </p>
      </div>
    );
  }

  const winner = view.roundWinner;
  const title =
    winner === null
      ? `FIRST TO ${WINS_TO_MATCH} WINS`
      : winner === "draw"
        ? "DRAW"
        : winner === view.me
          ? "ROUND WIN"
          : "ROUND LOSE";
  const color = winner === null || winner === "draw" ? "text-foreground" : TEXT_COLOR[winner];
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 select-none ${color}`}
    >
      <p className="neon-text text-2xl font-black tracking-[0.2em] sm:text-4xl">{title}</p>
      <p className="text-sm tracking-widest">
        <StartKey />で READY
      </p>
      <p className="flex gap-6 text-xs tracking-widest">
        <span className={TEXT_COLOR[view.me]}>YOU {view.ready[view.me] ? "READY" : "…"}</span>
        <span className={TEXT_COLOR[rival]}>RIVAL {view.ready[rival] ? "READY" : "…"}</span>
      </p>
    </div>
  );
}

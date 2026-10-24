import type { BikeId, Direction, Phase, Result } from "@/features/game/engine";

// ゲスト → ホスト
export type InputMessage =
  | { kind: "turn"; direction: Direction }
  | { kind: "boost" }
  | { kind: "ready" }
  // 盤面の差分を取りこぼしたので、全体を送り直してほしい
  | { kind: "sync" };

export type BikeState = {
  id: BikeId;
  x: number;
  y: number;
  dir: Direction;
  alive: boolean;
  boostsLeft: number;
  boostElapsedMs: number | null;
};

// 対戦の進み具合。画面の表示はこれと phase から決まる
export type MatchState = {
  // 0 は 1 ラウンド目の開始前
  round: number;
  wins: Record<BikeId, number>;
  ready: Record<BikeId, boolean>;
  // 走り出すまでの残り秒数。カウントダウン中でなければ null
  countdown: number | null;
  roundWinner: BikeId | "draw" | null;
  matchWinner: BikeId | null;
};

// ホスト → ゲスト
export type StateMessage = MatchState & {
  // 差分の取りこぼしを見つけるための通し番号
  seq: number;
  phase: Phase;
  result: Result | null;
  bikes: BikeState[];
  // 前回から変わったセルを [index, 値, index, 値, ...] で並べたもの
  diff?: number[];
  // 盤面全体（base64）。最初と、取りこぼしのあとに送る
  cells?: string;
};

// current と baseline の違うセルを差分にし、baseline を current に合わせる
export function diffCells(current: Uint8Array, baseline: Uint8Array): number[] {
  const diff: number[] = [];
  for (let i = 0; i < current.length; i++) {
    if (current[i] === baseline[i]) continue;
    diff.push(i, current[i]);
    baseline[i] = current[i];
  }
  return diff;
}

export function applyDiff(cells: Uint8Array, diff: number[]): void {
  for (let i = 0; i < diff.length; i += 2) {
    cells[diff[i]] = diff[i + 1];
  }
}

export function encodeCells(cells: Uint8Array): string {
  let binary = "";
  for (const value of cells) binary += String.fromCharCode(value);
  return btoa(binary);
}

export function decodeCells(encoded: string, target: Uint8Array): void {
  const binary = atob(encoded);
  for (let i = 0; i < target.length; i++) target[i] = binary.charCodeAt(i);
}

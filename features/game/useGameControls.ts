"use client";

import { useEffect, type RefObject } from "react";
import type { Direction } from "./engine";

// 決着の直後は SPACE を受け付けない（ブーストの押下で結果画面を飛ばしてしまうのを防ぐ）
export const RESTART_GUARD_MS = 600;

// これ以上指が動いたらスワイプとみなす
const SWIPE_THRESHOLD_PX = 24;

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

export type ControlHandlers = {
  turn: (direction: Direction) => void;
  boost: () => void;
  // 走行中でなければ、開始または次のラウンドへ進む
  start: () => void;
  isRunning: () => boolean;
};

export const NOOP_HANDLERS: ControlHandlers = {
  turn: () => {},
  boost: () => {},
  start: () => {},
  isRunning: () => false,
};

// キーボードとスワイプ・タップの操作を handlersRef に渡す。handlersRef は呼ぶたびに読むので、あとから差し替えてよい
export function useGameControls(
  touchAreaRef: RefObject<HTMLElement | null>,
  handlersRef: RefObject<ControlHandlers>,
): void {
  useEffect(() => {
    const touchArea = touchAreaRef.current;
    if (!touchArea) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // 名前入力中のキー（スペースや WASD）をゲーム操作として拾わない
      if (event.target instanceof HTMLInputElement) return;
      const handlers = handlersRef.current;
      if (event.key === " ") {
        event.preventDefault();
        if (event.repeat) return;
        if (handlers.isRunning()) handlers.boost();
        else handlers.start();
        return;
      }
      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) return;
      event.preventDefault();
      handlers.turn(direction);
    };

    // タッチ操作: スワイプした向きに曲がり、タップで開始する（方向ボタンでも曲がれる）。マウスは対象にしない
    let swipe: { id: number; x: number; y: number; moved: boolean } | null = null;

    // ボタンやスコア登録フォームに触れたときは、ゲーム操作として拾わない
    const isControl = (target: EventTarget | null) =>
      target instanceof Element && target.closest("button, a, input, form") !== null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || isControl(event.target)) return;
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!swipe || event.pointerId !== swipe.id) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
      const handlers = handlersRef.current;
      if (Math.abs(dx) > Math.abs(dy)) handlers.turn(dx > 0 ? "right" : "left");
      else handlers.turn(dy > 0 ? "down" : "up");
      // 指を離さずに続けて曲がれるよう、基準点をいまの位置に移す
      swipe = { id: swipe.id, x: event.clientX, y: event.clientY, moved: true };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!swipe || event.pointerId !== swipe.id) return;
      const tapped = !swipe.moved;
      swipe = null;
      if (tapped) handlersRef.current.start();
    };

    const onPointerCancel = () => {
      swipe = null;
    };

    window.addEventListener("keydown", onKeyDown);
    touchArea.addEventListener("pointerdown", onPointerDown);
    touchArea.addEventListener("pointermove", onPointerMove);
    touchArea.addEventListener("pointerup", onPointerUp);
    touchArea.addEventListener("pointercancel", onPointerCancel);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      touchArea.removeEventListener("pointerdown", onPointerDown);
      touchArea.removeEventListener("pointermove", onPointerMove);
      touchArea.removeEventListener("pointerup", onPointerUp);
      touchArea.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [touchAreaRef, handlersRef]);
}

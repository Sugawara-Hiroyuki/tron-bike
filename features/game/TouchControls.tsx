"use client";

import type { RefObject } from "react";
import type { Direction } from "./engine";
import type { ControlHandlers } from "./useGameControls";

// 方向ボタンの並び。十字に置くための grid 上の位置と、▲ を回す角度を持つ
const DPAD_BUTTONS: { direction: Direction; label: string; position: string; rotate: string }[] = [
  { direction: "up", label: "上", position: "col-start-2 row-start-1", rotate: "" },
  { direction: "left", label: "左", position: "col-start-1 row-start-2", rotate: "-rotate-90" },
  { direction: "right", label: "右", position: "col-start-3 row-start-2", rotate: "rotate-90" },
  { direction: "down", label: "下", position: "col-start-2 row-start-3", rotate: "rotate-180" },
];

// タッチ操作のときだけ出す BOOST ボタンと方向ボタン。GameCanvas の grid の中に直接並べる
export default function TouchControls({
  handlersRef,
  boostDisabled,
}: {
  handlersRef: RefObject<ControlHandlers>;
  boostDisabled: boolean;
}) {
  return (
    <>
      <button
        type="button"
        disabled={boostDisabled}
        onPointerDown={() => handlersRef.current.boost()}
        className="neon-box hidden size-16 touch-manipulation justify-self-center rounded-full border border-player text-[10px] font-black tracking-widest text-player select-none active:bg-player/20 disabled:opacity-30 lg:size-24 lg:text-sm pointer-coarse:block pointer-coarse:landscape:col-start-1 pointer-coarse:landscape:row-start-1"
      >
        BOOST
      </button>
      <div className="hidden grid-cols-3 grid-rows-3 gap-1 justify-self-center pointer-coarse:grid pointer-coarse:landscape:col-start-3 pointer-coarse:landscape:row-start-1">
        {DPAD_BUTTONS.map(({ direction, label, position, rotate }) => (
          <button
            key={direction}
            type="button"
            aria-label={label}
            onPointerDown={() => handlersRef.current.turn(direction)}
            className={`neon-box flex size-12 touch-manipulation items-center justify-center border border-player text-player select-none active:bg-player/20 lg:size-16 ${position}`}
          >
            <svg viewBox="0 0 10 10" aria-hidden="true" className={`size-5 fill-current ${rotate}`}>
              <path d="M5 1 9 9H1Z" />
            </svg>
          </button>
        ))}
      </div>
    </>
  );
}

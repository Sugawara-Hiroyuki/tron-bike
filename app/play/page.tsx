import type { Metadata } from "next";
import Link from "next/link";
import GameCanvas from "@/features/game/GameCanvas";

export const metadata: Metadata = {
  title: "PLAY",
};

export default function PlayPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6 pointer-coarse:landscape:gap-2 pointer-coarse:landscape:py-2 pointer-coarse:landscape:pr-12 pointer-coarse:landscape:pl-2">
      <GameCanvas />
      <p className="text-xs tracking-widest text-foreground/60 pointer-coarse:hidden">
        矢印キー / WASD で方向転換 ・ SPACE で開始 ・ 走行中 SPACE でブースト（3回）
      </p>
      {/* 横向きではプレイ画面を大きくするために出さない */}
      <p className="hidden text-center text-xs tracking-widest text-foreground/60 pointer-coarse:portrait:block">
        横向きにすると大きく遊べます
        <br />
        方向ボタン / スワイプで方向転換 ・ タップで開始 ・ BOOST ボタンでブースト（3回）
      </p>
      <Link href="/" className="text-sm tracking-widest text-foreground/70 hover:text-player">
        ← TITLE
      </Link>
    </main>
  );
}

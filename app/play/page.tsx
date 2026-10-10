import type { Metadata } from "next";
import Link from "next/link";
import GameCanvas from "@/features/game/GameCanvas";

export const metadata: Metadata = {
  title: "PLAY",
};

export default function PlayPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
      <GameCanvas />
      <p className="text-xs tracking-widest text-foreground/60">
        矢印キー / WASD で方向転換 ・ SPACE で開始 ・ 走行中 SPACE でブースト（3回）
      </p>
      <Link href="/" className="text-sm tracking-widest text-foreground/70 hover:text-player">
        ← TITLE
      </Link>
    </main>
  );
}

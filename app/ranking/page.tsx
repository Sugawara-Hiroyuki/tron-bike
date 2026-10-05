import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "RANKING",
};

export default function RankingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <h1 className="neon-text text-3xl tracking-widest text-cpu">RANKING</h1>
      <p className="text-sm text-foreground/70">ランキングは後のフェーズで実装します</p>
      <Link href="/" className="text-sm tracking-widest text-foreground/70 hover:text-cpu">
        ← TITLE
      </Link>
    </main>
  );
}

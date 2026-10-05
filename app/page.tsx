import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 px-6 text-center">
      <div className="flex flex-col gap-4">
        <h1 className="neon-text text-5xl font-black tracking-[0.3em] text-player sm:text-7xl">
          TRON BIKE
        </h1>
        <p className="text-sm tracking-widest text-foreground/70">
          光の壁で相手を囲め
        </p>
      </div>
      <nav className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/play"
          className="neon-box border border-player px-10 py-3 tracking-widest text-player transition-colors hover:bg-player/10"
        >
          START
        </Link>
        <Link
          href="/ranking"
          className="neon-box border border-cpu px-10 py-3 tracking-widest text-cpu transition-colors hover:bg-cpu/10"
        >
          RANKING
        </Link>
      </nav>
    </main>
  );
}

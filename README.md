# LIGHT BIKE

光の壁を引き合うバイクゲーム。Next.js の学習用に作ったもの。

- 2D Canvas・CPU 対戦。勝つとステージが進み、速くなる
- 操作: 矢印キー / WASD で方向転換、SPACE で開始
- 走行中の SPACE でブースト。2 秒間スピードが最大 2 倍になる（負けるまでに 3 回）
- スコアは Server Action で Neon Postgres に保存し、`/ranking` に表示

## 開発

```bash
npm install
npx vercel env pull .env.local   # DATABASE_URL を取得
npm run dev
```

コミット前に `npm run lint` / `npx tsc --noEmit` / `npm run build` を通す。

テーブル定義は `db/migrations/` にある。

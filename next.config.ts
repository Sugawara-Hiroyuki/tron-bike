import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // 同じ Wi-Fi のスマホやタブレットから開発サーバーを開けるようにする（開発時のみ有効）
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;

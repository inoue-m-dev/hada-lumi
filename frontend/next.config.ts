import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false, // ← これで左下のNを非表示
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modul native (skia) tidak bisa dilewat webpack; dipakai langsung di runtime.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.GITHUB_ACTIONS ? "/loa-phien-dich-viet-nhat" : "",
  assetPrefix: process.env.GITHUB_ACTIONS ? "/loa-phien-dich-viet-nhat/" : "",
};

export default nextConfig;

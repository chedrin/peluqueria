import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer se ejecuta solo en el servidor (route handler del PDF)
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;

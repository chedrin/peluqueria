import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Solo servidor: Prisma y pg no se empaquetan con webpack
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pg"],
};

export default nextConfig;

// Expone los bindings de Cloudflare en `next dev`
initOpenNextCloudflareForDev();

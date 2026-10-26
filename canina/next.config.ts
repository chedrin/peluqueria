import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo servidor: Prisma y pg no se empaquetan con webpack
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pg"],
};

export default nextConfig;

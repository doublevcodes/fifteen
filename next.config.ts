import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "pg", "@prisma/adapter-pg"],
};

export default withWorkflow(nextConfig);

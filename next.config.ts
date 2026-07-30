import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle in .next/standalone for small Docker images.
  output: "standalone",

  // `next build` was OOM-killing the CI build worker (SIGKILL). The peak memory
  // came from running full-project type-checking and ESLint *inside* the build:
  // that loads the entire type graph — including lucide-react's ~2.2MB icon
  // declaration file — on top of the bundler. Keep those checks out of the build
  // and run them as separate, cheaper steps instead:
  //   npm run typecheck   (tsc --noEmit)
  //   npm run lint        (eslint)
  // Run them in CI / pre-push so type + lint errors are still caught.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Rewrite `import { Icon } from "lucide-react"` to per-icon imports so the
  // bundler never pulls the full ~1,750-icon barrel. (lucide-react is on Next's
  // default optimize list; pinning it here is explicit and free.)
  experimental: { optimizePackageImports: ["lucide-react"] },
};

export default nextConfig;

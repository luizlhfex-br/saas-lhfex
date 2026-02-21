import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths() as any],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
    exclude: [
      "node_modules/",
      "build/",
      "dist/",
      ".idea/",
      ".git/",
      ".cache/",
      "tests/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "drizzle/",
        "build/",
        "**/*.config.ts",
        "**/*.d.ts",
        "**/types/",
      ],
    },
  },
});

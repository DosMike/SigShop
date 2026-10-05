import { defineConfig } from "vite";

export default defineConfig({
  // Relative assets keep the build portable across GitHub Pages project paths.
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
  },
});

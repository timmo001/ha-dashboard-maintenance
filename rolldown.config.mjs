import { defineConfig } from "rolldown";

const dev = process.argv.includes("--watch");

export default defineConfig({
  input: "src/dashboard-maintenance.ts",
  output: {
    file: "dist/ha-dashboard-maintenance.js",
    format: "es",
    minify: !dev,
    sourcemap: dev ? "inline" : false,
    codeSplitting: false,
  },
});

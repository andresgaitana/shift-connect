import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Static SPA build for GitHub Pages.
// `base` must match the repo name so assets resolve under /shift-connect/.
export default defineConfig({
  base: "/shift-connect/",
  plugins: [
    tsConfigPaths(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
});

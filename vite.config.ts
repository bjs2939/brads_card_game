//vite.config.ts
//C:\Users\brad330\Desktop\Brad's Work\Programs\Brads_Card_Game\vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// vite configuration for brads card game
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
  },
});
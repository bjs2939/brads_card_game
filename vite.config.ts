//vite.config.ts
//C:\Users\brad330\Desktop\Brad's Work\Programs\Brads_Card_Game\vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { friendRoomMiddleware } from "./multiplayer/rooms.mjs";

// vite configuration for brads card game
export default defineConfig({
  cacheDir: ".cache/vite",
  plugins: [react(), { name: "friend-rooms", configureServer(server) { server.middlewares.use(friendRoomMiddleware()); } }],

  server: {
    port: 5173,
  },
});

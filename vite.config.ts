import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createTimetableApi } from "./server/timetable-api.mjs";
import { createSeptaProxy } from "./server/septa-proxy.mjs";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "oneline-septa-proxy",
      configureServer(server) {
        server.middlewares.use(createTimetableApi());
        server.middlewares.use(createSeptaProxy());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createTimetableApi());
        server.middlewares.use(createSeptaProxy());
      },
    },
  ],
});

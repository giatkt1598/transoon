import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("@mui/material") ||
              id.includes("@mui/icons-material") ||
              id.includes("@emotion/react") ||
              id.includes("@emotion/styled")
            ) {
              return "mui";
            }

            if (
              id.includes("react-router-dom") ||
              id.includes("react-dom") ||
              id.includes(`${"node_modules"}${"/"}react${"/"}`)
            ) {
              return "react";
            }

            if (id.includes("socket.io-client")) {
              return "realtime";
            }
          }

          return undefined;
        },
      },
    },
  },
});

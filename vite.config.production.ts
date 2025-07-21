import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Production Vite configuration for Linux VPS deployment
export default defineConfig({
  plugins: [
    react({
      // Production optimizations
      babel: {
        compact: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "server/public"),
    emptyOutDir: true,
    // Production optimizations for VPS
    minify: "terser",
    sourcemap: false,
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari13"],
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-select"],
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env.VITE_BUILD_TARGET": '"vps"',
  },
});
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
  esbuild: {
    // Ensure React is properly handled in production
    jsxInject: `import React from 'react'`,
  },
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
    // Production optimizations for VPS with memory constraints
    minify: "esbuild",
    sourcemap: false,
    target: ["es2022", "chrome90", "firefox80", "safari14", "edge90"],
    rollupOptions: {
      output: {
        manualChunks: {
          // Simple chunking to avoid React bundling issues
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-toast'],
          'chart-vendor': ['recharts'],
          'util-vendor': ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
      maxParallelFileOps: 1, // Reduce parallel operations to save memory
    },
    chunkSizeWarningLimit: 1000,
    assetsInlineLimit: 0, // Don't inline assets to reduce memory usage
    reportCompressedSize: false, // Skip compression reporting to save memory
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
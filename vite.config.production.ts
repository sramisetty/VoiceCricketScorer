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
    // Production optimizations for VPS with memory constraints
    minify: "esbuild",
    sourcemap: false,
    target: ["es2022", "chrome90", "firefox80", "safari14", "edge90"],
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // More granular chunking to reduce memory usage
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@radix-ui')) {
              return 'radix-ui';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts';
            }
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind')) {
              return 'utils';
            }
            return 'vendor';
          }
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
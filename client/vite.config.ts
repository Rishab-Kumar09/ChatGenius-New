import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Get the API URL from environment or fallback to localhost
const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = process.env.VITE_WS_URL || 'ws://localhost:3000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), runtimeErrorOverlay()],
  css: {
    postcss: './postcss.config.cjs',
    // Ensure CSS is properly extracted and minified
    modules: {
      localsConvention: 'camelCase',
      scopeBehaviour: 'local',
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: API_URL,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/ws': {
        target: WS_URL,
        ws: true,
      },
    },
  },
  build: {
    outDir: process.env.AWS_LAMBDA_FUNCTION_VERSION 
      ? '/opt/nodejs/dist/public'
      : process.env.RENDER 
        ? path.join(process.env.RENDER_PROJECT_DIR || '', 'dist/public')
        : process.env.REPL_ID
          ? path.join(process.env.REPL_HOME || '', 'dist/public')
          : '../dist/public',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    // Ensure CSS is extracted and properly handled
    cssCodeSplit: false,
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@db": path.resolve(__dirname, "../db"),
    },
  },
}) 
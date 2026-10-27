import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // In development the SPA talks to the API through this proxy, so cookies stay same-origin.
  // Override when the backend runs elsewhere (macOS AirPlay often occupies port 5000):
  //   VITE_DEV_API_TARGET=http://localhost:5050 npm run dev --workspace=client
  const target = env.VITE_DEV_API_TARGET || 'http://localhost:5000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': { target, changeOrigin: true, secure: false },
        '/socket.io': { target, ws: true, changeOrigin: true },
      },
    },
    preview: { port: 4173 },
    build: { sourcemap: false },
  };
});

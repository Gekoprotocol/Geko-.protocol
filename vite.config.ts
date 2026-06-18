import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      'process.env': JSON.stringify(env)
    },
    server: {
      host: '0.0.0.0',
      port: 8080,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8081',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path
        },
        '/manifest.json': {
          target: 'http://127.0.0.1:8081',
          changeOrigin: true
        }
      }
    },
    build: {
      target: 'esnext',
      outDir: 'dist',
      emptyOutDir: true
    }
  };
});

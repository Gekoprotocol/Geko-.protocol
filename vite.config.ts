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
      port: 5000,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://0.0.0.0:3000',
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

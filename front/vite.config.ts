import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // L'API (back/) tourne sur le port 3001 : le front l'appelle via /api.
    proxy: { '/api': 'http://localhost:3001' },
  },
});

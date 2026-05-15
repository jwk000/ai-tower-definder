import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // GitHub Pages: 如果仓库名不是 ai-tower-defender，改成对应名称
  base: '/ai-tower-defender/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@config': resolve(__dirname, 'src/config'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});

import { defineConfig } from 'vite';
import { resolve } from 'path';
import preact from '@preact/preset-vite';
import { editorFsApi } from './vite-plugins/editor-fs-api';

export default defineConfig({
  // GitHub Pages: 如果仓库名不是 TowerDefender，改成对应名称
  base: '/ai-tower-defender/',
  plugins: [preact(), editorFsApi()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@components': resolve(__dirname, 'src/components'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@data': resolve(__dirname, 'src/data'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@render': resolve(__dirname, 'src/render'),
      '@input': resolve(__dirname, 'src/input'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});

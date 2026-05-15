import { Game } from './core/Game.js';
import { Renderer } from './render/Renderer.js';

const GRID_COLS = 21;
const GRID_ROWS = 9;
const CELL_SIZE = 64;

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found in index.html');
  }

  const renderer = new Renderer({
    canvas,
    worldWidth: GRID_COLS * CELL_SIZE,
    worldHeight: GRID_ROWS * CELL_SIZE,
    cellSize: CELL_SIZE,
  });
  await renderer.init();

  const game = new Game();

  let lastTime = performance.now();
  renderer.app.ticker.add(() => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0) game.tick(dt);
  });
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err);
});

import { Application, Text, TextStyle } from 'pixi.js';

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas element #game-canvas not found in index.html');
  }

  const app = new Application();
  await app.init({
    canvas,
    width: 1920,
    height: 1080,
    background: 0x1a1a2e,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
  });

  const style = new TextStyle({
    fill: 0xffffff,
    fontFamily: 'sans-serif',
    fontSize: 64,
    fontWeight: '700',
  });

  const text = new Text({ text: 'Hello v3.4 MVP', style });
  text.anchor.set(0.5);
  text.x = app.screen.width / 2;
  text.y = app.screen.height / 2;
  app.stage.addChild(text);
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err);
});

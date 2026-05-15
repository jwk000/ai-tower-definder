import { describe, it, expect, beforeEach } from 'vitest';

import { InputManager, type PointerEvent, type InputHandler } from '../InputManager.js';

function ev(x: number, y: number, type: PointerEvent['type'] = 'down'): PointerEvent {
  return { type, x, y };
}

function recordingHandler(name: string, consume: boolean, log: string[]): InputHandler {
  return (e) => {
    log.push(`${name}@${e.x},${e.y}`);
    return consume;
  };
}

describe('InputManager — queue + flush', () => {
  let mgr: InputManager;

  beforeEach(() => {
    mgr = new InputManager();
  });

  it('does not dispatch events on enqueue — only on flush', () => {
    const log: string[] = [];
    mgr.register('battlefield', recordingHandler('bf', false, log));
    mgr.enqueue(ev(10, 20));
    mgr.enqueue(ev(30, 40));
    expect(log).toEqual([]);

    mgr.flush();
    expect(log).toEqual(['bf@10,20', 'bf@30,40']);
  });

  it('flush() drains the queue — second flush is a no-op', () => {
    const log: string[] = [];
    mgr.register('battlefield', recordingHandler('bf', false, log));
    mgr.enqueue(ev(1, 2));
    mgr.flush();
    mgr.flush();
    expect(log).toEqual(['bf@1,2']);
  });

  it('preserves enqueue order (FIFO)', () => {
    const log: string[] = [];
    mgr.register('battlefield', recordingHandler('bf', false, log));
    mgr.enqueue(ev(1, 1));
    mgr.enqueue(ev(2, 2));
    mgr.enqueue(ev(3, 3));
    mgr.flush();
    expect(log).toEqual(['bf@1,1', 'bf@2,2', 'bf@3,3']);
  });
});

describe('InputManager — priority dispatch', () => {
  let mgr: InputManager;
  let log: string[];

  beforeEach(() => {
    mgr = new InputManager();
    log = [];
    mgr.register('battlefield', recordingHandler('bf', false, log));
    mgr.register('hand', recordingHandler('hand', false, log));
    mgr.register('ui', recordingHandler('ui', false, log));
  });

  it('dispatches in fixed priority order ui > hand > battlefield', () => {
    mgr.enqueue(ev(5, 5));
    mgr.flush();
    expect(log).toEqual(['ui@5,5', 'hand@5,5', 'bf@5,5']);
  });

  it('stops dispatching once a handler consumes the event', () => {
    mgr.register('ui', recordingHandler('ui-consumer', true, log), { replace: true });
    mgr.enqueue(ev(7, 8));
    mgr.flush();
    expect(log).toEqual(['ui-consumer@7,8']);
  });

  it('skips a layer when handler returns false but next consumes', () => {
    mgr.register('hand', recordingHandler('hand-consumer', true, log), { replace: true });
    mgr.enqueue(ev(9, 9));
    mgr.flush();
    expect(log).toEqual(['ui@9,9', 'hand-consumer@9,9']);
  });
});

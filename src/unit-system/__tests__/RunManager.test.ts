import { describe, expect, it } from 'vitest';

import { RunManager, RunPhase } from '../RunManager.js';

function makeManager(totalLevels = 1): RunManager {
  return new RunManager({ totalLevels });
}

describe('RunManager state machine', () => {
  it('starts in Idle phase with no active level', () => {
    const run = makeManager();
    expect(run.phase).toBe(RunPhase.Idle);
    expect(run.currentLevel).toBe(0);
  });

  it('startRun transitions Idle -> Battle and sets level to 1', () => {
    const run = makeManager();
    run.startRun();
    expect(run.phase).toBe(RunPhase.Battle);
    expect(run.currentLevel).toBe(1);
  });

  it('rejects startRun when not in Idle', () => {
    const run = makeManager();
    run.startRun();
    expect(() => run.startRun()).toThrow(/illegal transition/i);
  });

  it('completeLevel from Battle with more levels remaining transitions to InterLevel', () => {
    const run = makeManager(3);
    run.startRun();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.InterLevel);
    expect(run.currentLevel).toBe(1);
  });

  it('completeLevel from Battle on final level transitions to Result with Victory outcome', () => {
    const run = makeManager(1);
    run.startRun();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('victory');
  });

  it('pickInterLevelChoice transitions InterLevel -> Battle and advances level', () => {
    const run = makeManager(3);
    run.startRun();
    run.completeLevel();
    run.pickInterLevelChoice('skip');
    expect(run.phase).toBe(RunPhase.Battle);
    expect(run.currentLevel).toBe(2);
  });

  it('failRun from Battle transitions to Result with Defeat outcome', () => {
    const run = makeManager(3);
    run.startRun();
    run.failRun();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('defeat');
  });

  it('rejects completeLevel when not in Battle', () => {
    const run = makeManager();
    expect(() => run.completeLevel()).toThrow(/illegal transition/i);
  });

  it('rejects pickInterLevelChoice when not in InterLevel', () => {
    const run = makeManager();
    run.startRun();
    expect(() => run.pickInterLevelChoice('skip')).toThrow(/illegal transition/i);
  });

  it('rejects pickInterLevelChoice with unknown choice value', () => {
    const run = makeManager(3);
    run.startRun();
    run.completeLevel();
    expect(() => run.pickInterLevelChoice('teleport' as unknown as 'skip')).toThrow(/unknown choice/i);
  });

  it('resetToIdle from Result returns to Idle and clears level/outcome', () => {
    const run = makeManager(1);
    run.startRun();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.Result);
    run.resetToIdle();
    expect(run.phase).toBe(RunPhase.Idle);
    expect(run.currentLevel).toBe(0);
    expect(run.outcome).toBeNull();
  });

  it('rejects resetToIdle when not in Result', () => {
    const run = makeManager();
    expect(() => run.resetToIdle()).toThrow(/illegal transition/i);
  });
});

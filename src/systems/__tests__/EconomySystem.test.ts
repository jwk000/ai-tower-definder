import { describe, expect, it } from 'vitest';

import { EconomySystem } from '../EconomySystem.js';

describe('EconomySystem', () => {
  it('starts at zero gold and zero sp', () => {
    const econ = new EconomySystem();
    expect(econ.gold).toBe(0);
    expect(econ.sp).toBe(0);
  });

  it('addGold increments the gold balance', () => {
    const econ = new EconomySystem();
    econ.addGold(10);
    econ.addGold(5);
    expect(econ.gold).toBe(15);
  });

  it('addSp increments the sp balance', () => {
    const econ = new EconomySystem();
    econ.addSp(3);
    econ.addSp(2);
    expect(econ.sp).toBe(5);
  });

  it('rejects negative or non-finite gold amounts', () => {
    const econ = new EconomySystem();
    expect(() => econ.addGold(-1)).toThrow(/amount/i);
    expect(() => econ.addGold(Number.NaN)).toThrow(/amount/i);
  });

  it('rejects negative or non-finite sp amounts', () => {
    const econ = new EconomySystem();
    expect(() => econ.addSp(-1)).toThrow(/amount/i);
    expect(() => econ.addSp(Number.POSITIVE_INFINITY)).toThrow(/amount/i);
  });

  it('grantLevelClearReward(level=1) awards 2 SP per the N*2 formula', () => {
    const econ = new EconomySystem();
    econ.grantLevelClearReward(1);
    expect(econ.sp).toBe(2);
  });

  it('grantLevelClearReward(level=5) awards 10 SP', () => {
    const econ = new EconomySystem();
    econ.grantLevelClearReward(5);
    expect(econ.sp).toBe(10);
  });

  it('grantLevelClearReward(level=8) awards 16 SP', () => {
    const econ = new EconomySystem();
    econ.grantLevelClearReward(8);
    expect(econ.sp).toBe(16);
  });

  it('rejects level <= 0 for grantLevelClearReward', () => {
    const econ = new EconomySystem();
    expect(() => econ.grantLevelClearReward(0)).toThrow(/level/i);
    expect(() => econ.grantLevelClearReward(-1)).toThrow(/level/i);
  });

  it('grantWaveCompleteBonus adds the configured wave reward to gold', () => {
    const econ = new EconomySystem({ waveCompleteGold: 25 });
    econ.grantWaveCompleteBonus();
    expect(econ.gold).toBe(25);
  });

  it('waveCompleteGold defaults to 20 when not configured', () => {
    const econ = new EconomySystem();
    econ.grantWaveCompleteBonus();
    expect(econ.gold).toBe(20);
  });

  it('exchangeGoldForSp converts gold to sp at the configured rate', () => {
    const econ = new EconomySystem({ goldPerSp: 50 });
    econ.addGold(100);
    const ok = econ.exchangeGoldForSp(2);
    expect(ok).toBe(true);
    expect(econ.gold).toBe(0);
    expect(econ.sp).toBe(2);
  });

  it('exchangeGoldForSp returns false and does not deduct when insufficient gold', () => {
    const econ = new EconomySystem({ goldPerSp: 50 });
    econ.addGold(30);
    const ok = econ.exchangeGoldForSp(1);
    expect(ok).toBe(false);
    expect(econ.gold).toBe(30);
    expect(econ.sp).toBe(0);
  });

  it('rejects non-positive sp amount for exchangeGoldForSp', () => {
    const econ = new EconomySystem();
    expect(() => econ.exchangeGoldForSp(0)).toThrow(/amount/i);
    expect(() => econ.exchangeGoldForSp(-1)).toThrow(/amount/i);
  });

  it('reset clears both gold and sp', () => {
    const econ = new EconomySystem();
    econ.addGold(100);
    econ.addSp(10);
    econ.reset();
    expect(econ.gold).toBe(0);
    expect(econ.sp).toBe(0);
  });
});

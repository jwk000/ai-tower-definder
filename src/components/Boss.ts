import { CType } from '../types/index.js';

export class Boss {
  readonly type = CType.Boss;
  phase: 1 | 2;
  phase2HpRatio: number;
  skills: string[];
  phaseTransitionTimer: number;

  constructor(skills: string[], phase2HpRatio: number = 0.5) {
    this.phase = 1;
    this.phase2HpRatio = phase2HpRatio;
    this.skills = skills;
    this.phaseTransitionTimer = 0;
  }
}

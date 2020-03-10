import { v1 as uuid } from 'uuid';

import { SkillGaussian } from './mathematics';
import { Rating } from './rating';

export class Variable extends SkillGaussian {
  messages: { [key: string]: SkillGaussian } = {};

  setVal(val: Variable | SkillGaussian): number {
    const delta = this.delta(val);
    this.pi = val.pi;
    this.tau = val.tau;
    return delta;
  }

  delta(other: Variable | SkillGaussian): number {
    const piDelta = Math.abs(this.pi - other.pi);
    if (piDelta === Infinity) {
      return 0;
    }

    return Math.max(Math.abs(this.tau - other.tau), Math.sqrt(piDelta));
  }

  updateMessage(
    factor: LikelihoodFactor | SumFactor | PriorFactor,
    pi = 0,
    tau = 0,
    message?: SkillGaussian,
  ): number {
    const newMessage = message ? message : new SkillGaussian(null, null, pi, tau);
    const str = factor.toString();
    const oldMessage = this.messages[str];
    this.messages[str] = newMessage;
    return this.setVal(this.div(oldMessage).mul(newMessage));
  }

  updateValue(
    factor: TruncateFactor | PriorFactor,
    pi = 0,
    tau = 0,
    value?: SkillGaussian,
  ): number {
    if (!value) {
      value = new SkillGaussian(null, null, pi, tau);
    }

    const oldMessage = this.messages[factor.toString()];
    this.messages[factor.toString()] = value.mul(oldMessage).div(this);
    return this.setVal(value);
  }

  toString(): string {
    const count = Object.keys(this.messages).length;
    const s = count === 1 ? '' : 's';
    const val = super.toString();
    return `<Variable ${val} with ${count} connection${s}>`;
  }
}

export class Factor {
  readonly uuid: string;

  constructor(public vars: Variable[]) {
    this.uuid = uuid();
    const k = this.toString();
    vars.forEach(v => {
      v.messages[k] = new SkillGaussian();
    });
  }

  down(): number {
    return 0;
  }

  up(): number {
    return 0;
  }

  get v(): Variable {
    if (this.vars.length !== 1) {
      throw new Error('Too long');
    }

    return this.vars[0];
  }

  toString(): string {
    const s = this.vars.length === 1 ? '' : 's';
    return `<Factor with ${this.vars.length} connection${s} ${this.uuid}>`;
  }
}

export class PriorFactor extends Factor {
  constructor(v: Variable, readonly val: Rating, readonly dynamic = 0) {
    super([v]);
  }

  down(): number {
    const sigma = Math.sqrt((this.val.sigma ** 2) + (this.dynamic ** 2));
    const value = new SkillGaussian(this.val.mu, sigma);
    return this.v.updateValue(this, undefined, undefined, value);
  }
}

export class LikelihoodFactor extends Factor {
  constructor(
    readonly mean: Variable,
    readonly value: Variable,
    readonly variance: number,
  ) {
    super([mean, value]);
  }

  calcA(v: SkillGaussian): number {
    return 1.0 / ((this.variance * v.pi) + 1.0);
  }

  down(): number {
    const msg = this.mean.div(this.mean.messages[this.toString()]);
    const a = this.calcA(msg);
    return this.value.updateMessage(this, a * msg.pi, a * msg.tau);
  }

  up(): number {
    const msg = this.value.div(this.value.messages[this.toString()]);
    const a = this.calcA(msg);
    return this.mean.updateMessage(this, a * msg.pi, a * msg.tau);
  }
}

export class SumFactor extends Factor {
  constructor(
    readonly sum: Variable,
    readonly terms: Variable[],
    readonly coeffs: number[],
  ) {
    super([sum].concat(terms));
  }

  down(): number {
    const k = this.toString();
    const msgs = this.terms.map(v => v.messages[k]);
    return this.update(this.sum, this.terms, msgs, this.coeffs);
  }

  up(index = 0): number {
    const coeff = this.coeffs[index];
    let x = 0;
    const coeffs = this.coeffs.map(c => {
      let p = -c / coeff;
      if (x === index) {
        p = 1.0 / coeff;
      }

      p = Number.isFinite(p) ? p : 0;
      if (coeff === 0) {
        p = 0;
      }

      x += 1;
      return p;
    });
    const vals = [...this.terms];
    vals[index] = this.sum;
    const k = this.toString();
    const msgs = vals.map(v => v.messages[k]);
    return this.update(this.terms[index], vals, msgs, coeffs);
  }

  update(
    v: Variable,
    vals: Variable[],
    msgs: SkillGaussian[],
    coeffs: number[],
  ): number {
    let piInv = 0;
    let mu = 0;
    for (let i = 0; i < vals.length; i++) {
      const val = vals[i];
      const msg = msgs[i];
      const coeff = coeffs[i];
      const div = val.div(msg);
      mu += coeff * div.mu;
      if (!Number.isFinite(piInv)) {
        continue;
      }

      piInv += (coeff ** 2) / div.pi;
    }

    const pi = 1.0 / piInv;
    const tau = pi * mu;
    return v.updateMessage(this, pi, tau);
  }
}

export class TruncateFactor extends Factor {
  constructor(
    v: Variable,
    readonly vFunc: (a: number, b: number) => number,
    readonly wFunc: (a: number, b: number) => number,
    readonly drawMargin: number,
  ) {
    super([v]);
  }

  up(): number {
    const val = this.v;
    const msg = this.v.messages[this.toString()];
    const div = val.div(msg);
    const sqrtPi = Math.sqrt(div.pi);
    const v = this.vFunc(div.tau / sqrtPi, this.drawMargin * sqrtPi);
    const w = this.wFunc(div.tau / sqrtPi, this.drawMargin * sqrtPi);
    const denom = 1.0 - w;
    const pi = div.pi / denom;
    const tau = (div.tau + (sqrtPi * v)) / denom;
    return val.updateValue(this, pi, tau);
  }
}

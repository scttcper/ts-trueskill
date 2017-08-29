import * as _ from 'lodash';
import { v1 as uuid } from 'uuid';

import { Gaussian } from './mathematics';
import { Rating } from './rating';

export class Variable extends Gaussian {
  messages: { [key: string]: Gaussian } = {};

  constructor() {
    super();
  }
  setVal(val: Variable | Gaussian) {
    const delta = this.delta(val);
    this.pi = val.pi;
    this.tau = val.tau;
    return delta;
  }
  delta(other: Variable | Gaussian) {
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
    message?: Gaussian,
  ) {
    const newMessage = message ? message : new Gaussian(null, null, pi, tau);
    const str = factor.toString();
    const oldMessage = this.messages[str];
    this.messages[str] = newMessage;
    return this.setVal(this.div(oldMessage).mul(newMessage));
  }
  updateValue(factor: TruncateFactor | PriorFactor, pi = 0, tau = 0, value?: Gaussian) {
    if (!value) {
      value = new Gaussian(null, null, pi, tau);
    }
    const oldMessage = this.messages[factor.toString()];
    this.messages[factor.toString()] = value.mul(oldMessage).div(this);
    return this.setVal(value);
  }
  toString() {
    const count = Object.keys(this.messages).length;
    const s = count === 1 ? '' : 's';
    const val = super.toString();
    return `<Variable ${val} with ${count} connection${s}>`;
  }
}

export class Factor {
  private uuid: string;
  constructor(public vars: Variable[]) {
    this.uuid = uuid();
    const k = this.toString();
    vars.forEach((v) => v.messages[k] = new Gaussian());
  }
  down() {
    return 0;
  }
  up() {
    return 0;
  }
  get v() {
    if (this.vars.length !== 1) {
      throw new Error('Too long');
    }
    return this.vars[0];
  }
  toString() {
    const s = this.vars.length === 1 ? '' : 's';
    return `<Factor with ${this.vars.length} connection${s} ${this.uuid}>`;
  }
}

export class PriorFactor extends Factor {
  constructor(v: Variable, private val: Rating, private dynamic = 0) {
    super([v]);
  }
  down() {
    const sigma = Math.sqrt(this.val.sigma ** 2 + this.dynamic ** 2);
    const value = new Gaussian(this.val.mu, sigma);
    return this.v.updateValue(this, undefined, undefined, value);
  }
}

export class LikelihoodFactor extends Factor {
  constructor(
    private mean: Variable,
    private value: Variable,
    private variance: number,
  ) {
    super([mean, value]);
  }
  calc_a(v: Gaussian) {
    return 1.0 / (1.0 + this.variance * v.pi);
  }
  down() {
    const msg = this.mean.div(this.mean.messages[this.toString()]);
    const a = this.calc_a(msg);
    return this.value.updateMessage(this, a * msg.pi, a * msg.tau);
  }
  up() {
    const msg = this.value.div(this.value.messages[this.toString()]);
    const a = this.calc_a(msg);
    return this.mean.updateMessage(this, a * msg.pi, a * msg.tau);
  }
}

export class SumFactor extends Factor {
  constructor(
    private sum: Variable,
    private terms: Variable[],
    private coeffs: number[],
  ) {
    super([sum].concat(terms));
  }
  down() {
    const k = this.toString();
    const msgs: Gaussian[] = this.terms.map((v) => v.messages[k]);
    return this.update(this.sum, this.terms, msgs, this.coeffs);
  }
  up(index = 0) {
    const coeff = this.coeffs[index];
    let x = 0;
    const coeffs = this.coeffs.map((c) => {
      let p = -c / coeff;
      if (x === index) {
        p = 1.0 / coeff;
      }
      p = (_.isFinite(p)) ? p : 0;
      if (coeff === 0) {
        p = 0;
      }
      x = x + 1;
      return p;
    });
    const vals = _.clone(this.terms);
    vals[index] = this.sum;
    const k = this.toString();
    const msgs: Gaussian[] = vals.map((v) => v.messages[k]);
    return this.update(this.terms[index], vals, msgs, coeffs);
  }
  update(v: Variable, vals: Variable[], msgs: Gaussian[], coeffs: number[]) {
    let piInv = 0;
    let mu = 0;
    for (let i = 0; i < vals.length; i++) {
      const val = vals[i];
      const msg = msgs[i];
      const coeff = coeffs[i];
      const div = val.div(msg);
      mu += coeff * div.mu;
      if (!_.isFinite(piInv)) {
        continue;
      }
      piInv += coeff ** 2 / div.pi;
    }
    const pi = 1.0 / piInv;
    const tau = pi * mu;
    return v.updateMessage(this, pi, tau);
  }
}

export class TruncateFactor extends Factor {
  constructor(
    v: Variable,
    private vFunc: (a: number, b: number) => number,
    private wFunc: (a: number, b: number) => number,
    private drawMargin: number,
  ) {
    super([v]);
  }
  up() {
    const val = this.v;
    const msg = this.v.messages[this.toString()];
    const div = val.div(msg);
    const sqrtPi = Math.sqrt(div.pi);
    const v = this.vFunc(div.tau / sqrtPi, this.drawMargin * sqrtPi);
    const w = this.wFunc(div.tau / sqrtPi, this.drawMargin * sqrtPi);
    const denom = (1.0 - w);
    const pi = div.pi / denom;
    const tau = (div.tau + sqrtPi * v) / denom;
    return val.updateValue(this, pi, tau);
  }
}

import * as _ from 'lodash';
import * as uuid from 'uuid/v4';

import { Gaussian } from './mathematics';

export class Variable extends Gaussian {
  messages: {property: Gaussian} | {} = {};

  constructor() {
    super();
  }
  set(val) {
    const delta = this.delta(val);
    this.pi = val.pi;
    this.tau = val.tau;
    return delta;
  }
  delta(other: Variable) {
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
    message = message || new Gaussian(null, null, pi, tau);
    const oldMessage = this.messages[factor.toString()];
    this.messages[factor.toString()] = message;
    const res = this.set(this.div(oldMessage).mul(message));
    return res;
  }
  updateValue(factor: TruncateFactor | PriorFactor, pi = 0, tau = 0, value?: Gaussian) {
    if (!value) {
      value = new Gaussian(null, null, pi, tau);
    }
    const oldMessage = this.messages[factor.toString()];
    this.messages[factor.toString()] = value.mul(oldMessage).div(this);
    return this.set(value);
  }
  toString() {
    const count = Object.keys(this.messages).length;
    const s = count === 1 ? '' : 's';
    const val = super.toString();
    return `<Variable ${val} with ${count} connection${s}>`;
  }
}

export class Factor {
  uuid = uuid();
  vars: Variable[];
  constructor(vars: Variable[]) {
    this.vars = vars;
    for (let v of vars) {
      v.messages[this.toString()] = new Gaussian();
    }
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
    return `<${this.constructor.name} with ${this.vars.length} connection${s} ${this.uuid}>`;
  }
}

export class PriorFactor extends Factor {
  val;
  dynamic;
  constructor(v, val, dynamic = 0) {
    super([v]);
    this.val = val;
    this.dynamic = dynamic;
  }
  down() {
    const sigma = Math.sqrt(this.val.sigma ** 2 + this.dynamic ** 2);
    const value = new Gaussian(this.val.mu, sigma);
    return this.v.updateValue(this, undefined, undefined, value);
  }
}

export class LikelihoodFactor extends Factor {
  mean: Variable;
  value: Variable;
  variance;
  constructor(meanVar: Variable, valueVar: Variable, variance) {
    super([meanVar, valueVar]);
    this.mean = meanVar;
    this.value = valueVar;
    this.variance = variance;
  }
  calc_a(v) {
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
  sum: Variable;
  terms: Variable[];
  coeffs: number[];

  constructor(sumVar: Variable, termVars: Variable[], coeffs: number[]) {
    super([sumVar].concat(termVars));
    this.sum = sumVar;
    this.terms = termVars;
    this.coeffs = coeffs;
  }
  down() {
    const msgs: Gaussian[] = this.terms.map((v) => v.messages[this.toString()]);
    return this.update(this.sum, this.terms, msgs, this.coeffs);
  }
  up(index = 0) {
    const coeff = this.coeffs[index];
    const coeffs = [];
    for (let x = 0; x < this.coeffs.length; x++) {
      const c = this.coeffs[x];
      let p;
      if (x === index) {
        p = 1.0 / coeff;
      } else {
        p = -c / coeff;
      }
      p = _.isFinite(p) ? p : 0;
      if (coeff === 0) {
        p = 0;
      }
      coeffs.push(p);
    }
    const vals = _.clone(this.terms);
    vals[index] = this.sum;
    const msgs: Gaussian[] = vals.map((v) => v.messages[this.toString()]);
    return this.update(this.terms[index], vals, msgs, coeffs);
  }
  update(v: Variable, vals: Variable[], msgs: Gaussian[], coeffs: number[]) {
    let piInv = 0;
    let mu = 0;
    // not sure why _.zip types were so angry
    const zipped: any[][] = _.zip<Variable|Gaussian|number>(vals, msgs, coeffs);
    let val: Variable;
    let msg: Gaussian;
    let coeff: number;
    for ([val, msg, coeff] of zipped) {
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
  vFunc: Function;
  wFunc: Function;
  drawMargin: number;
  constructor(v: Variable, vFunc: Function, wFunc: Function, drawMargin: number) {
    super([v]);
    this.vFunc = vFunc;
    this.wFunc = wFunc;
    this.drawMargin = drawMargin;
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

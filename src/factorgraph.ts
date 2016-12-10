import * as assert from 'assert';
import * as _ from 'lodash';

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
  delta(other) {
    const pi_delta = Math.abs(this.pi - other.pi);
    if (pi_delta === Infinity) {
      return 0;
    }
    return _.max([Math.abs(this.tau - other.tau), Math.sqrt(pi_delta)]);
  }
  updateMessage(
    factor:LikelihoodFactor | SumFactor | PriorFactor,
    pi=0,
    tau=0,
    message?: Gaussian
  ) {
    message = message || new Gaussian(null, null, pi, tau);
    const old_message = this.messages[factor.toString()];
    this.messages[factor.toString()] = message;
    return this.set(this.div(old_message).mul(message));
  }
  updateValue(factor:TruncateFactor | PriorFactor, pi=0, tau=0, value?: Gaussian) {
    if (!value) {
      value = new Gaussian(null, null, pi, tau);
    }
    const old_message = this.messages[factor.toString()];
    this.messages[factor.toString()] = value.mul(old_message).div(this);
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
    assert(this.vars.length == 1);
    return this.vars[0];
  }
  toString() {
    const s = this.vars.length === 1 ? '' : 's';
    return `<${this.constructor.name} with ${this.vars.length} connection${s}>`
  }
}

export class PriorFactor extends Factor {
  val;
  dynamic;
  constructor(v, val, dynamic=0) {
    super([v]);
    this.val = val;
    this.dynamic = dynamic;
  }
  down() {
    const sigma = Math.sqrt(this.val.sigma ** 2 + this.dynamic ** 2);
    const value = new Gaussian(this.val.mu, sigma);
    return this.v.updateValue(this, undefined, undefined, value)
  }
}

export class LikelihoodFactor extends Factor {
  mean: Variable;
  value: Variable;
  variance;
  constructor(mean_var: Variable, value_var: Variable, variance) {
    super([mean_var, value_var]);
    this.mean = mean_var;
    this.value = value_var;
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

  constructor(sum_var: Variable, term_vars: Variable[], coeffs: number[]) {
    super([sum_var].concat(term_vars));
    if (term_vars.length !== coeffs.length) {
      throw new Error('NOT EQUAL')
    }
    this.sum = sum_var;
    this.terms = term_vars;
    this.coeffs = coeffs;
  }
  down() {
    const vals = this.terms;
    const msgs = _.map(vals, (v) => v.messages[this.toString()]);
    return this.update(this.sum, vals, msgs, this.coeffs);
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
      coeffs.push(p);
    }
    const vals = _.clone(this.terms);
    vals[index] = this.sum;
    const msgs = _.map(vals, (v) => v.messages[this.toString()]);
    return this.update(this.terms[index], vals, msgs, coeffs);
  }
  update(v: Variable, vals: Variable[], msgs: Gaussian[], coeffs: number[]) {
    let pi_inv = 0;
    let mu = 0;
    // not sure why _.zip types were so angry
    const zipped: any[][] = _.zip<Variable|Gaussian|number>(vals, msgs, coeffs);
    console.log('msgs', msgs)
    // TODO: find out why msgs is blank??
    let val: Variable, msg: Gaussian, coeff: number;
    for ([val, msg, coeff] of zipped) {
      console.log(val, msg)
      const div = val.div(msg);
      mu += coeff * div.mu;
      if (!_.isFinite(pi_inv)) {
        continue;
      }
      pi_inv = pi_inv + (coeff ** 2 / div.pi);
    }
    const pi = 1 / pi_inv;
    const tau = pi * mu;
    return v.updateMessage(this, pi, tau);
  }
}

export class TruncateFactor extends Factor {
  v_func;
  w_func;
  draw_margin;
  constructor(v, v_func, w_func, draw_margin: number) {
    super([v]);
    this.v_func = v_func;
    this.w_func = w_func;
    if (_.isNaN(draw_margin)) {
      throw new Error('NAN')
    }
    this.draw_margin = draw_margin;
  }
  up() {
    const val = this.v;
    const msg = this.v.messages[this.toString()];
    const div = val.div(msg);
    const sqrt_pi = Math.sqrt(div.pi);
    const v = this.v_func(div.tau / sqrt_pi, this.draw_margin * sqrt_pi);
    const w = this.w_func(div.tau / sqrt_pi, this.draw_margin * sqrt_pi);
    const denom = (1.0 - w);
    const pi = div.pi / denom;
    const tau = (div.tau + sqrt_pi * v) / denom;
    return val.updateValue(this, pi, tau);
  }
}

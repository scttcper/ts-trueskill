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
    [this.pi, this.tau] = [val.pi, val.tau]
    return delta;
  }
  delta(other) {
    const pi_delta = Math.abs(this.pi - other.pi);
    if (pi_delta === Infinity) {
      return 0;
    }
    return _.max([Math.abs(this.tau - other.tau), Math.sqrt(pi_delta)]);
  }
  updateMessage(factor:Gaussian, pi=0, tau=0, message?: Gaussian) {
    message = message || new Gaussian(pi=pi, tau=tau)
    let old_message: Gaussian;
    [old_message, this.messages[factor.toString()]] = [this.messages[factor.toString()], message];
    return this.set(this.div(old_message.mul(message)));
  }
  updateValue(factor:Gaussian, pi=0, tau=0, value?: Gaussian) {
    value = value || new Gaussian(pi=pi, tau=tau);
    const old_message = this[factor.toString()];
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
  vars: any[];
  constructor(vars: Object[]) {
    this.vars = vars;
    for (let v of vars) {
      v[this.toString()] = new Gaussian();
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
    return `<Factor with ${this.vars.length} connection${s}>`
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
    return this.v.updateValue(value)
  }
}

export class LikelihoodFactor extends Factor {
  mean:Variable;
  value;
  variance;
  constructor(mean_var:Variable, value_var, variance) {
    super([mean_var, value_var]);
    this.mean = mean_var;
    this.value = value_var;
    this.variance = variance;
  }
  calc_a(v) {
    return 1.0 / (1.0 + this.variance * v.pi);
  }
  down() {
    const msg = this.mean.div(this.mean[this.toString()]);
    const a = this.calc_a(msg);
    return this.value.update_message(a * msg.pi, a * msg.tau);
  }
}

export class SumFactor extends Factor {
  sum: Variable;
  terms: Variable[];
  coeffs;

  constructor(sum_var: Variable, term_vars: Variable[], coeffs) {
    super([sum_var].concat(term_vars));
    this.sum = sum_var;
    this.terms = term_vars;
    this.coeffs = coeffs;
  }
  down() {
    const vals = this.terms;
    const msgs = _.map(vals, (v) => v[this.toString()]);
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
    const msgs = _.map(vals, (v) => v[this.toString()]);
    return this.update(this.terms[index], vals, msgs, coeffs);
  }
  update(v: Variable, vals: Variable[], msgs, coeffs) {
    let pi_inv = 0;
    let mu = 0;
    for (let [val, msg, coeff] of _.zip(vals, msgs, coeffs)) {
      const div = val.div(msg);
      mu = mu + (coeff.mul(div));
      if (!_.isFinite(pi_inv)) {
        continue;
      }
      pi_inv = pi_inv + (coeff ** 2 / div.pi);
    }
    const pi = 1 / pi_inv;
    const tau = pi * mu;
    return v.update_message(pi, tau);
  }
}

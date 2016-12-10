import * as _ from 'lodash';

/**
 * A model for the normal distribution.
 */
export class Gaussian {
  /** Precision, the inverse of the variance. */
  _pi = 0;
  /** Precision adjusted mean, the precision multiplied by the mean. */
  tau = 0;
  constructor(mu: number = null, sigma: number = null, pi = 0, tau = 0) {
    console.log(mu, sigma, pi, tau)
    if (mu !== null) {
      if (sigma === null) {
        throw new TypeError('sigma argument is needed');
      } else if (sigma === 0) {
        throw new Error('sigma**2 should be greater than 0');
      }
      pi = sigma ** -2;
      tau = pi * mu;
    }
    this.pi = pi;
    this.tau = tau;
    if (_.isNaN(this.pi)) {
      throw new Error('NAN');
    }
    if (_.isNaN(this.tau)) {
      throw new Error('NAN');
    }
  }
  get pi() {
    return this._pi;
  }
  set pi(value) {
    this._pi = value;
  }

  /** A property which returns the mean. */
  get mu() {
    return this.pi && this.tau / this.pi;
  }
  get sigma() {
    if (this.pi) {
      return Math.sqrt(1 / this.pi);
    }
    return Infinity;
  }

  mul(other: Gaussian) {
    console.log('MUL', this.pi, other.pi)
    const pi = this.pi + other.pi;
    const tau = this.tau + other.tau;
    return new Gaussian(null, null, pi, tau);
  }
  div(other: Gaussian) {
    console.log('DIVY', this.pi, other.pi)
    if (this.pi === 0 && other.pi !== 0) {
      throw new Error('wtffff')
    }
    const pi = this.pi - other.pi;
    const tau = this.tau - other.tau;
    console.log('div', pi, tau)
    return new Gaussian(null, null, pi, tau);
  }
  eq(other: Gaussian) {
    return this.pi === other.pi && this.tau === other.tau;
  }
  lt(other: Gaussian) {
    return this.pi === other.pi && this.tau === other.tau;
  }
  le(other: Gaussian) {
    return this.mu <= other.mu;
  }
  gt(other: Gaussian) {
    return this.mu > other.mu;
  }
  ge(other: Gaussian) {
    return this.mu >= other.mu
  }
  toString() {
    return `N(mu=${this.mu}, sigma=${this.sigma})`;
  }
}

export class Matrix {
  matrix: number[][];
  constructor(src, height = 0, width = 0) {

  }
}

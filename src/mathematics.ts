import * as _ from 'lodash';

/**
 * A model for the normal distribution.
 */
export class Gaussian {
  /** Precision, the inverse of the variance. */
  pi = 0;
  /** Precision adjusted mean, the precision multiplied by the mean. */
  tau = 0;
  constructor(mu: number = null, sigma: number = null, pi = 0, tau = 0) {
    // console.log('GAUSSIAN', mu, sigma, pi, tau)
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
    if (_.isNaN(this.pi) || _.isNaN(this.tau)) {
      throw new Error('NAN');
    }
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
    const pi = this.pi + other.pi;
    const tau = this.tau + other.tau;
    return new Gaussian(null, null, pi, tau);
  }
  div(other: Gaussian) {
    const pi = this.pi - other.pi;
    const tau = this.tau - other.tau;
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
    return this.mu >= other.mu;
  }
  val() {
    return [this.mu, this.sigma];
  }
  toString() {
    const mu = _.round(this.mu, 3);
    let sigma = this.sigma;
    if (sigma !== Infinity) {
      sigma = _.round(this.sigma, 3);
    }
    return `N(mu=${mu}, sigma=${sigma})`;
  }
}

export class Matrix {
  matrix: number[][];
  constructor(src, height = 0, width = 0) {}
}

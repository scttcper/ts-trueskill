/**
 * A model for the normal distribution.
 */
export class Gaussian {
  /** Precision, the inverse of the variance. */
  pi = 0;
  /** Precision adjusted mean, the precision multiplied by the mean. */
  tau = 0;
  constructor(mu: number = null, sigma: number = null, pi = 0, tau = 0) {
    console.log(mu, sigma);
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
    const [pi, tau] = [this.pi + other.pi, this.tau + other.tau];
    return new Gaussian(pi, tau);
  }
  div(other: Gaussian) {
    const [pi, tau] = [this.pi - other.pi, this.tau - other.tau];
    return new Gaussian(pi, tau);
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
    return `N(mu=%{this.mu}, sigma=${this.sigma})`;
  }
}

export class Matrix {
  matrix: number[][];
  constructor(src, height = 0, width = 0) {

  }
}

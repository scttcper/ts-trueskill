/**
 * A model for the normal distribution.
 */
export class SkillGaussian {
  constructor(
    mu: number | null = null,
    sigma: number | null = null,
    /** Precision, the inverse of the variance. */
    public pi = 0,
    /** Precision adjusted mean, the precision multiplied by the mean. */
    public tau = 0,
  ) {
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
  mul(other: SkillGaussian) {
    const pi = this.pi + other.pi;
    const tau = this.tau + other.tau;
    return new SkillGaussian(null, null, pi, tau);
  }
  div(other: SkillGaussian) {
    const pi = this.pi - other.pi;
    const tau = this.tau - other.tau;
    return new SkillGaussian(null, null, pi, tau);
  }
  toString() {
    const mu = this.mu.toPrecision(3);
    const sigma = this.sigma.toPrecision(3);
    return `N(mu=${mu}, sigma=${sigma})`;
  }
}

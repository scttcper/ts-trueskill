/**
 * A model for the normal distribution.
 */
export class SkillGaussian {
  /**
   * @param pi - Precision, the inverse of the variance.
   * @param tau - Precision adjusted mean, the precision multiplied by the mean
   */
  constructor(
    mu: number | null = null,
    sigma: number | null = null,
    public pi = 0,
    public tau = 0,
  ) {
    if (mu !== null) {
      if (sigma === null) {
        throw new TypeError('sigma argument is needed');
      }

      if (sigma === 0) {
        throw new Error('sigma**2 should be greater than 0');
      }

      pi = Math.pow(sigma, -2);
      tau = pi * mu;
    }

    this.pi = pi;
    this.tau = tau;
  }

  /**
   * A property which returns the mean.
   */
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

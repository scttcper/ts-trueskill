import { SkillGaussian } from './mathematics.js';

export class Rating extends SkillGaussian {
  constructor(mu: number | SkillGaussian | [number, number] = 25, sigma?: number) {
    if (Array.isArray(mu)) {
      [mu, sigma] = mu;
    } else if (mu instanceof SkillGaussian) {
      sigma = mu.sigma;
      mu = mu.mu;
    }

    if (sigma === undefined) {
      sigma = mu / 3;
    }

    super(mu, sigma);
  }

  override toString(): string {
    const mu = this.mu.toFixed(3);
    const sigma = this.sigma.toFixed(3);
    return `Rating(mu=${mu}, sigma=${sigma})`;
  }
}

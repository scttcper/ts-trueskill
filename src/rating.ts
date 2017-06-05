import { global_env } from './index';
import { Gaussian } from './mathematics';

/**
 * The default mu and sigma value follows the global environment's settings.
 * If you don't want to use the global, use `TrueSkill.createRating` to
 * create the rating object.
 */
export class Rating extends Gaussian {
  constructor(mu?: number | Gaussian | [number, number], sigma?: number) {
    if (Array.isArray(mu)) {
      [mu, sigma] = mu;
    } else if (mu instanceof Gaussian) {
      sigma = mu.sigma;
      mu = mu.mu;
    }
    if (!mu) {
      mu = global_env().mu;
    }
    if (!sigma) {
      sigma = global_env().sigma;
    }
    super(mu, sigma);
  }
  toString() {
    const mu = this.mu.toFixed(3);
    const sigma = this.sigma.toFixed(3);
    return `Rating(mu=${mu}, sigma=${sigma})`;
  }
}

import * as _ from 'lodash';

import { Gaussian } from './mathematics';
import {
  Variable,
  PriorFactor,
  LikelihoodFactor,
  SumFactor,
} from './factorgraph';

// Default initial mean of ratings.
const MU = 25;
// Default initial standard deviation of ratings.
const SIGMA = MU / 3;
// Default distance that guarantees about 76% chance of winning.
const BETA = SIGMA / 2;
// Default dynamic factor.
const TAU = SIGMA / 100;
// Default draw probability of the game.
const DRAW_PROBABILITY = 0.10;
// A basis to check reliability of the result.
const DELTA = 0.0001;

/**
 * Makes a size map of each teams.
 */
function _teamSizes(ratingGroups) {
  const team_sizes = [];
  for (let group of ratingGroups) {
    team_sizes.push(group.length + _.last(team_sizes) || 0);
  }
  return team_sizes;
}

/**
 * The default mu and sigma value follows the global environment's settings.
 * If you don't want to use the global, use :meth:`TrueSkill.create_rating` to
 * create the rating object.
 * :param mu: the mean.
 * :param sigma: the standard deviation.
 */
export class Rating extends Gaussian {
  constructor(mu?, tuple?) {
    let sigma;
    if (Array.isArray(mu)) {
      [mu, sigma] = mu;
    } else if (mu instanceof Gaussian) {
      [mu, sigma] = [mu.mu, mu.sigma];
    }
    super(mu, sigma);
  }
  toString() {
    return `${this.mu}, ${this.sigma}`;
  }
}

export class TrueSkill {
  private mu: number;
  private sigma: number;
  private beta: number;
  private tau: number;
  private drawProbability: number;
  private backend: any;

  constructor(
    mu = MU,
    sigma = SIGMA,
    beta = BETA,
    tau = TAU,
    drawProbability = DRAW_PROBABILITY,
    backend?,
  ) {
    this.mu = mu;
    this.sigma = sigma;
    this.beta = beta;
    this.tau = tau;
    this.drawProbability = drawProbability;
    this.backend = backend;
  }

  /**
   * Initializes new :class:`Rating` object, but it fixes default mu and
   * sigma to the environment's.
   * >>> env = TrueSkill(mu=0, sigma=1)
   * >>> env.createRating()
   * trueskill.Rating(mu=0.000, sigma=1.000)
   */
  createRating(mu?, sigma?) {
    if (!mu) {
        mu = this.mu;
    }
    if (!sigma) {
      sigma = this.sigma;
    }
    return new Rating(mu, sigma);
  }

  /**
   * Recalculates ratings by the ranking table
   */
  rate(ratingGroups: any[][], ranks: any[] = null, weights: any[] = null, min_delta = DELTA) {
    let keys;
    [ratingGroups, keys] = this.validateRatingGroups(ratingGroups);
    const groupSize = ratingGroups.length;
    if (ranks === null) {
      ranks = _.range(groupSize)
    } else if (ranks.length !== groupSize) {
      throw new Error('Wrong ranks');
    }
    // sort rating groups by rank
    let zip = _.zip(ratingGroups, ranks, weights)
    let n = 0;
    zip = zip.map((el) => {
      const y = [n, el];
      n = n + 1;
      return y;
    });
    const sorting = _.sortBy(zip, (x) => x[1][1]);
    let [sortedRatingGroups, sortedRanks, sortedWeights] = [[], [], []];
    for (let [x, [g, r, w]] of sorting) {
      sortedRatingGroups.push(g)
      sortedRanks.push(r)
      // make weights to be greater than 0
      const max = _.max([min_delta, _.max(w)]);
      sortedWeights.push(max);
    }
    // build factor graph
    const builders = this.factorGraphBuilders(sortedRatingGroups, sortedRanks, sortedWeights);
  }

  /**
   * Validates a ``rating_groups`` argument.  It should contain more than
   * 2 groups and all groups must not be empty.
   * >>> env = TrueSkill()
   * >>> env.validate_rating_groups([])
   * Traceback (most recent call last):
   *   ...
   * ValueError: need multiple rating groups
   * >>> env.validate_rating_groups([(Rating(),)])
   * Traceback (most recent call last):
   *   ...
   * ValueError: need multiple rating groups
   * >>> env.validate_rating_groups([(Rating(),), ()])
   * Traceback (most recent call last):
   *   ...
   * ValueError: each group must contain multiple ratings
   * >>> env.validate_rating_groups([(Rating(),), (Rating(),)])
   * ... #doctest: +ELLIPSIS
   * [(truekill.Rating(...),), (trueskill.Rating(...),)]
   */
  validateRatingGroups(ratingGroups) {
    if (ratingGroups.length < 2) {
      throw new Error('Need multiple rating groups');
    }
    ratingGroups = _.toArray(ratingGroups);
    const keys = null;
    return [ratingGroups, keys]
  }

  /**
   * Makes nodes for the TrueSkill factor graph.
   */
  factorGraphBuilders(ratingGroups: any[][], ranks: any[], weights: any[]) {
    const flattenRatings = _.flatten(ratingGroups);
    const flattenWeights = _.flatten(weights);
    const size = flattenRatings.length;
    const groupSize = ratingGroups.length;
    // create variables
    const ratingVars: Variable[] = _.range(size).map(() => new Variable());
    const perfVars: Variable[] = _.range(size).map(() => new Variable());
    const teamPerfVars: Variable[] = _.range(groupSize).map(() => new Variable());
    const teamDiffVars: Variable[] = _.range(groupSize - 1).map(() => new Variable());
    const team_sizes = _teamSizes(ratingGroups);
    // layer builders
    function *build_rating_layer() {
      for (let [rating_var, rating] of _.zip(ratingVars, flattenRatings)) {
        yield new PriorFactor(rating_var, rating, this.tau);
      }
    }
    function *build_perf_layer() {
      for (let [rating_var, perf_var] of _.zip(ratingVars, perfVars)) {
        yield new LikelihoodFactor(rating_var, perf_var, this.beta ** 2)
      }
    }
    function *build_team_perf_layer() {
      let team = 0;
      for (let team_perf_var of teamPerfVars) {
        let start;
        if (team > 0) {
          start = team_sizes[team - 1];
        } else {
          start = 0;
        }
        const end = team_sizes[team];
        const child_perf_vars = _.slice(perfVars, start, end);
        const coeffs = _.slice(flattenWeights, start, end);
        team = team + 1;
        yield new SumFactor(team_perf_var, child_perf_vars, coeffs);
      }
    }
  }
}

export let __trueskill__;
/**
 * Gets the :class:`TrueSkill` object which is the global environment.
 */
export function global_env() {
  if (__trueskill__) {
    return __trueskill__;
  }
  setup();
  return __trueskill__;
}

/**
 * Setups the global environment.
 */
function setup(mu=MU, sigma=SIGMA, beta=BETA, tau=TAU,
               draw_probability=DRAW_PROBABILITY, backend?, env?) {
  if (!env) {
    env = new TrueSkill(mu, sigma, beta, tau, draw_probability, backend);
  }
  __trueskill__ = env;
  return env;
}

/**
 * A proxy function for :meth:`TrueSkill.rate` of the global environment.
 */
export function rate(rating_groups, ranks?, weights?, min_delta=DELTA) {
  return global_env().rate(rating_groups, ranks, weights, min_delta)
}

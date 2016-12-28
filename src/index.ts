import * as _ from 'lodash';
import * as math from 'mathjs';
const gaus = require('gaussian');

import {
  LikelihoodFactor,
  PriorFactor,
  SumFactor,
  TruncateFactor,
  Variable,
} from './factorgraph';
import { Gaussian, Matrix } from './mathematics';

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
 * Calculates a draw-margin from the given ``draw_probability``
 */
export function calc_draw_margin(draw_probability, size: number, env: TrueSkill = global_env()) {
  return env.ppf((draw_probability + 1) / 2) * Math.sqrt(size) * env.beta;
}

/**
 * Makes a size map of each teams.
 */
function _teamSizes(ratingGroups) {
  const team_sizes = [0];
  for (let group of ratingGroups) {
    team_sizes.push(group.length + _.last(team_sizes));
  }
  team_sizes.shift();
  return team_sizes;
}

/**
 * The default mu and sigma value follows the global environment's settings.
 * If you don't want to use the global, use :meth:`TrueSkill.createRating` to
 * create the rating object.
 */
export class Rating extends Gaussian {
  constructor(mu?, sigma?) {
    if (Array.isArray(mu)) {
      [mu, sigma] = mu;
    } else if (mu instanceof Gaussian) {
      [mu, sigma] = [mu.mu, mu.sigma];
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
    return `${this.mu}, ${this.sigma}`;
  }
}

/**
 * Implements a TrueSkill environment.  An environment could have
 * customized constants.  Every games have not same design and may need to
 * customize TrueSkill constants.
 *
 * For example, 60% of matches in your game have finished as draw then you
 * should set ``draw_probability`` to 0.60::
 *
 * env = TrueSkill(draw_probability=0.60)
 *
 * For more details of the constants, see `The Math Behind TrueSkill`_ by
 * Jeff Moser.
 *
 * .. _The Math Behind TrueSkill:: http://bit.ly/trueskill-math
 */
export class TrueSkill {
  mu: number;
  sigma: number;
  beta: number;
  tau: number;
  drawProbability: number;
  backend: any;

  constructor(mu?, sigma?, beta?, tau?, drawProbability?, backend?) {
    this.mu = mu || MU;
    this.sigma = sigma || SIGMA;
    this.beta = beta || BETA;
    this.tau = tau || TAU;
    this.drawProbability = drawProbability || DRAW_PROBABILITY;
    this.backend = backend;
  }

  /**
   * Initializes new :class:`Rating` object, but it fixes default mu and
   * sigma to the environment's.
   * >>> env = TrueSkill(mu=0, sigma=1)
   * >>> env.createRating()
   * trueskill.Rating(mu=0.000, sigma=1.000)
   */
  createRating(mu = this.mu, sigma = this.sigma) {
    return new Rating(mu, sigma);
  }

  /**
   * The non-draw version of "V" function.
   * "V" calculates a variation of a mean.
   */
  v_win(diff, draw_margin) {
    const x = diff - draw_margin;
    const denom = this.cdf(x);
    return denom ? (this.pdf(x) / denom) : -x;
  }
  v_draw(diff, draw_margin) {
    const abs_diff = Math.abs(diff);
    const [a, b] = [draw_margin - abs_diff, -draw_margin - abs_diff];
    const denom = this.cdf(a) - this.cdf(b);
    const numer = this.pdf(b) - this.pdf(a);
    return (denom ? (numer / denom) : a) * (diff < 0 ? -1 : +1);
  }
  /**
   * The non-draw version of "W" function.
   * "W" calculates a variation of a standard deviation.
   */
  w_win(diff, draw_margin) {
    // if (diff !== 1.5491313744672435) {
    //   throw new Error('wtf')
    // }
    const x = diff - draw_margin;
    const v = this.v_win(diff, draw_margin);
    const w = v * (v + x);
    if (0 < w && w < 1) {
      return w;
    }
    throw new Error('floating point error');
  }
  /**
   * The draw version of "W" function.
   */
  w_draw(diff, draw_margin) {
    const abs_diff = Math.abs(diff);
    const a = draw_margin - abs_diff;
    const b = -draw_margin - abs_diff;
    const denom = this.cdf(a) - this.cdf(b);
    if (!denom) {
      throw new Error('Floating point error');
    }
    const v = this.v_draw(abs_diff, draw_margin);
    return (v ** 2) + (a * this.pdf(a) - b * this.pdf(b)) / denom;
  }

  /**
   * Recalculates ratings by the ranking table
   */
  rate(ratingGroups: Rating[][], ranks: any[] = null, weights: any[] = null, min_delta = DELTA) {
    ratingGroups = this.validateRatingGroups(ratingGroups);
    weights = this.validate_weights(weights, ratingGroups);
    const groupSize = ratingGroups.length;
    if (ranks === null) {
      ranks = _.range(groupSize);
    } else if (ranks.length !== groupSize) {
      throw new Error('Wrong ranks');
    }
    // sort rating groups by rank
    let zip = _.zip(ratingGroups, ranks, weights);
    let n = 0;
    zip = zip.map((el) => {
      const y = [n, el];
      n = n + 1;
      return y;
    });
    const sorting = _.orderBy(zip, (x) => {
      return x[1][1];
    });
    const sortedRatingGroups = [];
    const sortedRanks = [];
    const sortedWeights = [];
    for (const [x, [g, r, w]] of sorting) {
      sortedRatingGroups.push(g);
      sortedRanks.push(r);
      // make weights to be greater than 0
      const max = _.map(w, (_w) => _.max([min_delta, _w]));
      sortedWeights.push(max);
    }
    // build factor graph
    const builders = this.factorGraphBuilders(sortedRatingGroups, sortedRanks, sortedWeights);
    const layers = this.run_schedule(
      builders[0],
      builders[1],
      builders[2],
      builders[3],
      builders[4],
      min_delta,
    );
    const rating_layer: any[] = layers[0];
    const team_sizes = _teamSizes(sortedRatingGroups);
    const transformed_groups = [];
    const trimmed = _.slice(team_sizes, 0, team_sizes.length - 1);
    for (let [start, end] of _.zip([0].concat(trimmed), team_sizes)) {
      const group = [];
      let f: PriorFactor;
      for (f of _.slice(rating_layer, start, end)) {
        group.push(new Rating(f.v.mu, f.v.sigma));
      }
      transformed_groups.push(group);
    }
    const pulled = [];
    for (let [x, zz] of sorting) {
      pulled.push(x);
    }
    const unsorting = _.sortBy(_.zip(pulled, transformed_groups), (zi) => zi[0]);
    return unsorting.map((k) => k[1]);
  }

  /**
   * Calculates the match quality of the given rating groups. Result
   * is the draw probability in the association::
   *
   *   env = TrueSkill()
   *   if env.quality([team1, team2, team3]) < 0.50 {
   *     console.log('This match seems to be not so fair')
   *   }
   */
  quality(rating_groups: Rating[][], weights: number[]) {
    rating_groups = this.validateRatingGroups(rating_groups);
    weights = this.validate_weights(weights, rating_groups);
    const flattenRatings = _.flatten(rating_groups);
    const flattenWeights = _.flatten(weights);
    const length = flattenRatings.length;
    // a vector of all of the skill means
    const mean_matrix = math.matrix(flattenRatings.map((r) => [r.mu]));
    function fn_variance_matrix(height, width) {
      const variances = flattenRatings.map((r) => r.sigma ** 2);
      const matrix = math.matrix().resize([height, width]);
      let i = 0;
      for (let f of variances) {
        matrix.set([i, i], f);
        i++;
      }
      return matrix;
    }
    const variance_matrix = fn_variance_matrix(length, length);
    function fn_rotated_a_matrix() {
      let t = 0;
      let r = 0;
      let d;
      const zipped = _.zip(
        rating_groups.slice(0, rating_groups.length - 1),
        rating_groups.slice(1),
      );
      const matrix = math.matrix();
      for (const [cur, next] of zipped) {
        let x;
        for (x of _.range(t, t + cur.length)) {
          matrix.set([r, x], flattenWeights[x]);
          t += 1;
        }
        x += 1;
        for (d of _.range(x, x + next.length)) {
          matrix.set([r, d], -flattenWeights[d]);
        }
        r++;
      }
      return matrix;
    }
    const rotated_a_matrix = fn_rotated_a_matrix();
    const a_matrix = math.transpose(rotated_a_matrix);
    // match quality further derivation
    const modified_rotated_a_matrix = rotated_a_matrix.map((value, index, matrix) => {
      return this.beta ** 2 * value;
    });
    const _ata = math.multiply(modified_rotated_a_matrix, a_matrix);
    const _atsa = math.multiply(rotated_a_matrix, math.multiply(variance_matrix, a_matrix));
    const start = math.multiply(math.transpose(mean_matrix), a_matrix);
    const middle: any = math.add(_ata, _atsa);
    const end = math.multiply(rotated_a_matrix, mean_matrix);
    // make result
    const e_arg = math.det(
      math.multiply(
        math.multiply([[-0.5]],
          math.multiply(start, math.inv(middle))),
          end,
        ),
      );
    const s_arg = math.det(_ata) / math.det(middle);
    return math.exp(e_arg) * math.sqrt(s_arg);
  }

  /**
   * Validates a rating_groups argument. It should contain more than
   * 2 groups and all groups must not be empty.
   */
  validateRatingGroups(ratingGroups: Rating[][]): Rating[][] {
    if (ratingGroups.length < 2) {
      throw new Error('Need multiple rating groups');
    }
    for (let group of ratingGroups) {
      if (group.length === 0) {
        throw new Error('Each group must contain multiple ratings');
      }
      if (group instanceof Rating) {
        throw new Error('Rating cannot be a rating group');
      }
    }
    return ratingGroups;
  }

  validate_weights(weights: any[] = null, ratingGroups: Rating[][]) {
    if (weights === null) {
      weights = _.map(ratingGroups, (n) => {
        return new Array(n.length).fill(1);
      });
    }
    // TODO: weights is dict?
    return weights;
  }

  /**
   * Makes nodes for the TrueSkill factor graph.
   */
  factorGraphBuilders(ratingGroups: Rating[][], ranks: any[], weights: any[]) {
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
    const _that: TrueSkill = this;
    function build_rating_layer(): PriorFactor[] {
      return _.map(_.zip(ratingVars, flattenRatings), (n) => {
        let [rating_var, rating] = n;
        return new PriorFactor(rating_var, rating, _that.tau);
      });
    }
    function build_perf_layer(): LikelihoodFactor[] {
      return _.map(_.zip(ratingVars, perfVars), (n) => {
        let [rating_var, perf_var] = n;
        return new LikelihoodFactor(rating_var, perf_var, _that.beta ** 2);
      });
    }
    function build_team_perf_layer(): SumFactor[] {
      let team = 0;
      return _.map(teamPerfVars, (team_perf_var) => {
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
        return new SumFactor(team_perf_var, child_perf_vars, coeffs);
      });
    }
    function build_team_diff_layer(): SumFactor[] {
      let team = 0;
      return _.map(teamDiffVars, (team_diff_var) => {
        const sl = _.slice(teamPerfVars, team, team + 2);
        const res = new SumFactor(team_diff_var, sl, [1, -1]);
        team = team + 1;
        return res;
      });
    }
    function build_trunc_layer(): TruncateFactor[] {
      let x = 0;
      return _.map(teamDiffVars, (team_diff_var) => {
        // static draw probability
        const draw_probability = _that.drawProbability;
        const lengths = _.slice(ratingGroups, x, x + 2).map((n) => n.length);
        const draw_margin = calc_draw_margin(draw_probability, _.sum(lengths), _that);
        let v_func;
        let w_func;
        if (ranks[x] === ranks[x + 1]) {
          v_func = (a, b) => _that.v_draw(a, b);
          w_func = (a, b) => _that.w_draw(a, b);
        } else {
          v_func = (a, b) => _that.v_win(a, b);
          w_func = (a, b) => _that.w_win(a, b);
        }
        const res = new TruncateFactor(team_diff_var, v_func, w_func, draw_margin);
        x = x + 1;
        return res;
      });
    }
    return [
      build_rating_layer,
      build_perf_layer,
      build_team_perf_layer,
      build_team_diff_layer,
      build_trunc_layer,
    ];
  }
  /**
   * Sends messages within every nodes of the factor graph
   * until the result is reliable.
   */
  run_schedule(
    build_rating_layer: Function,
    build_perf_layer: Function,
    build_team_perf_layer: Function,
    build_team_diff_layer: Function,
    build_trunc_layer: Function,
    min_delta = DELTA,
  ) {
    if (min_delta <= 0) {
      throw new Error('min_delta must be greater than 0');
    }
    const layers = [];
    function build(builders) {
      const layers_built = [];
      for (const builder of builders) {
        const res = builder();
        layers_built.push(res);
      }
      layers.push(layers_built);
      return layers_built;
    }
    const layers_built = build([
      build_rating_layer,
      build_perf_layer,
      build_team_perf_layer,
    ]);
    let rating_layer: Rating[];
    let perf_layer: LikelihoodFactor[];
    let team_perf_layer: SumFactor[];
    [rating_layer, perf_layer, team_perf_layer] = layers_built;
    for (let layer of layers_built) {
      for (let f of layer) {
        f.down();
      }
    }
    // arrow #1, #2, #3
    let team_diff_layer: SumFactor[];
    let trunc_layer: TruncateFactor[];
    [team_diff_layer, trunc_layer] = build([
      build_team_diff_layer,
      build_trunc_layer,
    ]);
    const team_diff_len = team_diff_layer.length;
    for (let x of _.range(10)) {
      let delta;
      if (team_diff_len === 1) {
        // only two teams
        team_diff_layer[0].down();
        delta = trunc_layer[0].up();
      } else {
        // multiple teams
        delta = 0;
        for (let z of _.range(team_diff_len - 1)) {
          team_diff_layer[z].down();
          delta = _.max([delta, trunc_layer[z].up()]);
          team_diff_layer[z].up(1);
        }
        for (let z of _.range(team_diff_len - 1, 0, -1)) {
          team_diff_layer[z].down();
          delta = _.max([delta, trunc_layer[z].up()]);
          team_diff_layer[z].up(0);
        }
      }
      // repeat until to small update
      if (delta <= min_delta) {
        break;
      }
    }
    // up both ends
    team_diff_layer[0].up(0);
    team_diff_layer[team_diff_len - 1].up(1);
    // up the remainder of the black arrows
    for (let f of team_perf_layer) {
      for (let x of _.range(f.vars.length - 1)) {
        f.up(x);
      }
    }
    for (let f of perf_layer) {
      f.up();
    }
    return _.flatten(layers);
  }
  ppf(x) {
    return gaus(0, 1).ppf(x);
  }
  pdf(x) {
    return gaus(0, 1).pdf(x);
  }
  cdf(x) {
    return gaus(0, 1).cdf(x);
  }
}

export let __trueskill__: TrueSkill;
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
export function setup(
  mu = MU,
  sigma = SIGMA,
  beta = BETA,
  tau = TAU,
  draw_probability = DRAW_PROBABILITY,
  backend?,
  env?,
) {
  if (!env) {
    env = new TrueSkill(mu, sigma, beta, tau, draw_probability, backend);
  }
  __trueskill__ = env;
  return env;
}

/**
 * A proxy function for :meth:`TrueSkill.rate` of the global environment.
 */
export function rate(rating_groups: Rating[][], ranks?, weights?, min_delta = DELTA): Rating[][] {
  return global_env().rate(rating_groups, ranks, weights, min_delta);
}

/**
 * A proxy function for :meth:`TrueSkill.quality` of the global
 * environment.
 */
export function quality(rating_groups: Rating[][], weights?: number[]) {
  return global_env().quality(rating_groups, weights);
}

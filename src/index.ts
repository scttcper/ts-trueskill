import * as gaussian from 'gaussian';
import * as _ from 'lodash';
import * as math from 'mathjs';

import {
  LikelihoodFactor,
  PriorFactor,
  SumFactor,
  TruncateFactor,
  Variable,
} from './factorgraph';
import { Gaussian } from './mathematics';

/** Default initial mean of ratings. */
const MU = 25;
/** Default initial standard deviation of ratings. */
const SIGMA = MU / 3;
/** Default distance that guarantees about 76% chance of winning. */
const BETA = SIGMA / 2;
/** Default dynamic factor. */
const TAU = SIGMA / 100;
/** Default draw probability of the game. */
const DRAW_PROBABILITY = 0.10;
/** A basis to check reliability of the result. */
const DELTA = 0.0001;
/** stores set global environment */
export let trueskill: TrueSkill;
/** reuseable gaussian */
const gaus = gaussian(0, 1);

/**
 * Calculates a draw-margin from the given drawProbability
 */
export function calcDrawMargin(drawProbability: number, size: number, env?: TrueSkill) {
  if (!env) {
    env = global_env();
  }
  return gaus.ppf((drawProbability + 1) / 2) * Math.sqrt(size) * env.beta;
}

/**
 * Makes a size map of each teams.
 */
function _teamSizes(ratingGroups: Rating[][]) {
  const teamSizes = [0];
  for (const group of ratingGroups) {
    teamSizes.push(group.length + teamSizes[teamSizes.length - 1]);
  }
  teamSizes.shift();
  return teamSizes;
}

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

/**
 * Implements a TrueSkill environment.  An environment could have
 * customized constants.  Every games have not same design and may need to
 * customize TrueSkill constants.
 *
 * For example, 60% of matches in your game have finished as draw then you
 * should set ``draw_probability`` to 0.60::
 *
 * const env = new TrueSkill(draw_probability=0.60)
 *
 * For more details of the constants, see `The Math Behind TrueSkill`_ by
 * Jeff Moser.
 *
 */
export class TrueSkill {
  mu: number;
  sigma: number;
  beta: number;
  tau: number;
  drawProbability: number;
  backend: any;

  constructor(
    mu?: number | null,
    sigma?: number | null,
    beta?: number | null,
    tau?: number | null,
    drawProbability?: number | null,
  ) {
    this.mu = mu || MU;
    this.sigma = sigma || SIGMA;
    this.beta = beta || BETA;
    this.tau = tau || TAU;
    if (drawProbability === undefined || drawProbability === null) {
      this.drawProbability = DRAW_PROBABILITY;
    } else {
      this.drawProbability = drawProbability;
    }
  }

  /** Recalculates ratings by the ranking table */
  rate(
    ratingGroups: Rating[][] | any[],
    ranks: number[] | null = null,
    weights: number[][] | null = null,
    minDelta = DELTA,
  ): Rating[][] | any[] {
    const [newRatingGroups, keys] = this.validateRatingGroups(ratingGroups);
    weights = this.validate_weights(newRatingGroups, weights);
    const groupSize = ratingGroups.length;
    if (ranks && ranks.length !== groupSize) {
      throw new Error('Wrong ranks');
    }
    const newRanks = ranks ? ranks : _.range(groupSize);
    // sort rating groups by rank
    const zip: Array<[Rating[], number, number[]]> = [];
    for (let idx = 0; idx < newRatingGroups.length; idx++) {
      zip.push([newRatingGroups[idx], newRanks[idx], weights[idx]]);
    }
    let position = 0;
    const positions = zip.map((el) => {
      const res: [number, [Rating[], number, number[]]] = [position, el];
      position++;
      return res;
    });
    const sorting = _.orderBy(positions, (x) => {
      return x[1][1];
    });
    const sortedRatingGroups: Rating[][] = [];
    const sortedRanks: number[] = [];
    const sortedWeights: number[][] = [];
    for (const [x, [g, r, w]] of sorting) {
      sortedRatingGroups.push(g);
      sortedRanks.push(r);
      // make weights to be greater than 0
      const max = w.map((ww: number) => Math.max(minDelta, ww));
      sortedWeights.push(max);
    }
    // build factor graph
    const flattenRatings = _.flatten(sortedRatingGroups);
    const flattenWeights = _.flatten(sortedWeights);
    const size = flattenRatings.length;
    // create variables
    const ratingVars: Variable[] = _.range(size).map(() => new Variable());
    const perfVars: Variable[] = _.range(size).map(() => new Variable());
    const teamPerfVars: Variable[] = _.range(groupSize).map(() => new Variable());
    const teamDiffVars: Variable[] = _.range(groupSize - 1).map(() => new Variable());
    const teamSizes = _teamSizes(sortedRatingGroups);
    // layer builders
    const buildRatingLayer = () => {
      const pf: PriorFactor[] = [];
      for (let idx = 0; idx < ratingVars.length; idx++) {
        pf.push(new PriorFactor(ratingVars[idx], flattenRatings[idx], this.tau));
      }
      return pf;
    };
    const buildPerfLayer = () => {
      const lf: LikelihoodFactor[] = [];
      for (let idx = 0; idx < ratingVars.length; idx++) {
        lf.push(new LikelihoodFactor(ratingVars[idx], perfVars[idx], this.beta ** 2));
      }
      return lf;
    };
    const buildTeamPerfLayer = () => {
      let team = 0;
      return teamPerfVars.map((teamPerfVar) => {
        const start = team > 0 ? teamSizes[team - 1] : 0;
        const end = teamSizes[team];
        team++;
        const childPerfVars = perfVars.slice(start, end);
        const coeffs = flattenWeights.slice(start, end);
        return new SumFactor(teamPerfVar, childPerfVars, coeffs);
      });
    };
    const buildTeamDiffLayer = () => {
      let team = 0;
      return teamDiffVars.map((teamDiffVar) => {
        const sl = teamPerfVars.slice(team, team + 2);
        team++;
        return new SumFactor(teamDiffVar, sl, [1, -1]);
      });
    };
    const buildTruncLayer = () => {
      let x = 0;
      return teamDiffVars.map((teamDiffVar) => {
        // static draw probability
        const drawProbability = this.drawProbability;
        const lengths = sortedRatingGroups.slice(x, x + 2).map((n) => n.length);
        const drawMargin = calcDrawMargin(drawProbability, _.sum(lengths), this);
        let vFunc;
        let wFunc;
        if (sortedRanks[x] === sortedRanks[x + 1]) {
          vFunc = (a: number, b: number) => this.v_draw(a, b);
          wFunc = (a: number, b: number) => this.w_draw(a, b);
        } else {
          vFunc = (a: number, b: number) => this.v_win(a, b);
          wFunc = (a: number, b: number) => this.w_win(a, b);
        }
        x++;
        return new TruncateFactor(teamDiffVar, vFunc, wFunc, drawMargin);
      });
    };
    const layers = this.runSchedule(
      buildRatingLayer,
      buildPerfLayer,
      buildTeamPerfLayer,
      buildTeamDiffLayer,
      buildTruncLayer,
      minDelta,
    );
    const ratingLayer: any[] = layers[0];
    const transformedGroups: Rating[][] = [];
    const trimmed = teamSizes.slice(0, teamSizes.length - 1);
    for (const [start, end] of _.zip([0].concat(trimmed), teamSizes)) {
      const group: Rating[] = [];
      ratingLayer.slice(start, end).map((f: PriorFactor) => {
        group.push(new Rating(f.v.mu, f.v.sigma));
      });
      transformedGroups.push(group);
    }
    const pulled = sorting.map(([x, zz]) => x);
    const pulledTranformedGroups: Array<[number, Rating[]]> = [];
    for (let idx = 0; idx < pulled.length; idx++) {
      pulledTranformedGroups.push([pulled[idx], transformedGroups[idx]]);
    }
    const unsorting = _.sortBy(pulledTranformedGroups, (zi) => zi[0]);
    if (!keys) {
      return unsorting.map((k) => k[1]);
    }
    return unsorting.map((v) => {
      return _.zipObject(keys[v[0]], v[1]);
    });
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
  quality(ratingGroups: Rating[][], weights?: number[][]) {
    const [newRatingGroups, keys] = this.validateRatingGroups(ratingGroups);
    const newWeights = this.validate_weights(ratingGroups, weights, keys);
    const flattenRatings = _.flatten(ratingGroups);
    const flattenWeights = _.flatten(newWeights);
    const length = flattenRatings.length;
    // a vector of all of the skill means
    const meanMatrix = math.matrix(flattenRatings.map((r) => [r.mu]));
    function fnVarianceMatrix(height: number, width: number) {
      const variances = flattenRatings.map((r) => r.sigma ** 2);
      const matrix = math.matrix().resize([height, width]);
      let i = 0;
      for (const f of variances) {
        matrix.set([i, i], f);
        i++;
      }
      return matrix;
    }
    const varianceMatrix = fnVarianceMatrix(length, length);
    function fn_rotatedAMatrix() {
      let t = 0;
      let r = 0;
      const zipped = _.zip(
        newRatingGroups.slice(0, newRatingGroups.length - 1),
        newRatingGroups.slice(1),
      );
      const matrix = math.matrix();
      for (const [cur, next] of zipped) {
        let x = 0;
        for (x of _.range(t, t + cur.length)) {
          matrix.set([r, x], flattenWeights[x]);
          t += 1;
        }
        x += 1;
        for (const d of _.range(x, x + next.length)) {
          matrix.set([r, d], -flattenWeights[d]);
        }
        r++;
      }
      return matrix;
    }
    const rotatedAMatrix = fn_rotatedAMatrix();
    const aMatrix = math.transpose(rotatedAMatrix);
    // match quality further derivation
    const modifiedRotatedAMatrix = rotatedAMatrix.map((value, index, matrix) => {
      return this.beta ** 2 * value;
    });
    const ata = math.multiply(modifiedRotatedAMatrix, aMatrix);
    const atsa = math.multiply(rotatedAMatrix, math.multiply(varianceMatrix, aMatrix));
    const start = math.multiply(math.transpose(meanMatrix), aMatrix);
    const middle: any = math.add(ata, atsa);
    const end = math.multiply(rotatedAMatrix, meanMatrix);
    // make result
    const eArg = math.det(
      math.multiply(
        math.multiply([[-0.5]],
          math.multiply(start, math.inv(middle))),
        end,
      ),
    );
    const sArg = math.det(ata) / math.det(middle);
    return math.exp(eArg) * math.sqrt(sArg);
  }

  /**
   * Initializes new `Rating` object, but it fixes default mu and
   * sigma to the environment's.
   * >>> env = TrueSkill(mu=0, sigma=1)
   * >>> env.createRating()
   * trueskill.Rating(mu=0.000, sigma=1.000)
   */
  createRating(mu = this.mu, sigma = this.sigma) {
    return new Rating(mu, sigma);
  }

  /**
   * Returns the value of the rating exposure.  It starts from 0 and
   * converges to the mean.  Use this as a sort key in a leaderboard
   */
  expose(rating: Rating) {
    const k = this.mu / this.sigma;
    return rating.mu - k * rating.sigma;
  }

  /**
   * Registers the environment as the global environment.
   */
  make_as_global() {
    return setup(undefined, undefined, undefined, undefined, undefined, this);
  }

  /**
   * Taken from https://github.com/sublee/trueskill/issues/1
   */
  winProbability(a: Rating[], b: Rating[]) {
    const deltaMu = _.sumBy(a, 'mu') - _.sumBy(b, _.identity('mu'));
    const sumSigma = _.sum(a.map((x) => x.sigma ** 2)) + _.sum(b.map((x) => x.sigma ** 2));
    const playerCount = a.length + b.length;
    const denominator = Math.sqrt(playerCount * (BETA * BETA) + sumSigma);
    return gaus.cdf(deltaMu / denominator);
  }

  /**
   * The non-draw version of "V" function.
   * "V" calculates a variation of a mean.
   */
  private v_win(diff: number, drawMargin: number) {
    const x = diff - drawMargin;
    const denom = gaus.cdf(x);
    return denom ? (gaus.pdf(x) / denom) : -x;
  }
  private v_draw(diff: number, drawMargin: number) {
    const absDiff = Math.abs(diff);
    const [a, b] = [drawMargin - absDiff, -drawMargin - absDiff];
    const denom = gaus.cdf(a) - gaus.cdf(b);
    const numer = gaus.pdf(b) - gaus.pdf(a);
    return (denom ? (numer / denom) : a) * (diff < 0 ? -1 : +1);
  }
  /**
   * The non-draw version of "W" function.
   * "W" calculates a variation of a standard deviation.
   */
  private w_win(diff: number, drawMargin: number) {
    const x = diff - drawMargin;
    const v = this.v_win(diff, drawMargin);
    const w = v * (v + x);
    if (0 < w && w < 1) {
      return w;
    }
    throw new Error('floating point error');
  }
  /** The draw version of "W" function. */
  private w_draw(diff: number, drawMargin: number) {
    const absDiff = Math.abs(diff);
    const a = drawMargin - absDiff;
    const b = -drawMargin - absDiff;
    const denom = gaus.cdf(a) - gaus.cdf(b);
    if (!denom) {
      throw new Error('Floating point error');
    }
    const v = this.v_draw(absDiff, drawMargin);
    return (v ** 2) + (a * gaus.pdf(a) - b * gaus.pdf(b)) / denom;
  }

  /**
   * Validates a ratingGroups argument. It should contain more than
   * 2 groups and all groups must not be empty.
   */
  private validateRatingGroups(ratingGroups: Rating[][] | any[]): [Rating[][], string[][] | null] {
    if (ratingGroups.length < 2) {
      throw new Error('Need multiple rating groups');
    }
    for (const group of ratingGroups) {
      if (group.length === 0) {
        throw new Error('Each group must contain multiple ratings');
      }
      if (group instanceof Rating) {
        throw new Error('Rating cannot be a rating group');
      }
    }
    if (!Array.isArray(ratingGroups[0])) {
      const keys: string[][] = [];
      const newRatingGroups: Rating[][] = [];
      for (const dictRatingGroup of ratingGroups) {
        const ratingGroup: Rating[] = [];
        const keyGroup: string[] = [];
        _.forEach(dictRatingGroup, (rating, key: string) => {
          ratingGroup.push(rating);
          keyGroup.push(key);
        });
        newRatingGroups.push(ratingGroup);
        keys.push(keyGroup);
      }
      return [newRatingGroups, keys];
    }
    return [ratingGroups, null];
  }

  private validate_weights(
    ratingGroups: Rating[][],
    weights?: number[][] | null,
    keys?: string[][] | null,
  ): number[][] {
    if (!weights) {
      return ratingGroups.map((n) => {
        return _.fill(Array(n.length), 1);
      });
    }
    // TODO: weights is dict?
    return weights;
  }

  /**
   * Sends messages within every nodes of the factor graph
   * until the result is reliable.
   */
  private runSchedule(
    buildRatingLayer: () => PriorFactor[],
    buildPerfLayer: () => LikelihoodFactor[],
    buildTeamPerfLayer: () => SumFactor[],
    buildTeamDiffLayer: () => SumFactor[],
    buildTruncLayer: () => TruncateFactor[],
    minDelta = DELTA,
  ) {
    if (minDelta <= 0) {
      throw new Error('minDelta must be greater than 0');
    }
    const layers = [];
    const ratingLayer: PriorFactor[] = buildRatingLayer();
    const perfLayer: LikelihoodFactor[] = buildPerfLayer();
    const teamPerfLayer: SumFactor[] = buildTeamPerfLayer();
    layers.push(ratingLayer, perfLayer, teamPerfLayer);
    for (const layer of [ratingLayer, perfLayer, teamPerfLayer]) {
      for (const f of layer) {
        f.down();
      }
    }
    // arrow #1, #2, #3
    const teamDiffLayer: SumFactor[] = buildTeamDiffLayer();
    const truncLayer: TruncateFactor[] = buildTruncLayer();
    layers.push(teamDiffLayer, truncLayer);
    const teamDiffLen = teamDiffLayer.length;
    for (let index = 0; index <= 10; index++) {
      let delta;
      if (teamDiffLen === 1) {
        // only two teams
        teamDiffLayer[0].down();
        delta = truncLayer[0].up();
      } else {
        // multiple teams
        delta = 0;
        for (const z of _.range(teamDiffLen - 1)) {
          teamDiffLayer[z].down();
          delta = Math.max(delta, truncLayer[z].up());
          teamDiffLayer[z].up(1);
        }
        for (const z of _.range(teamDiffLen - 1, 0, -1)) {
          teamDiffLayer[z].down();
          delta = Math.max(delta, truncLayer[z].up());
          teamDiffLayer[z].up(0);
        }
      }
      // repeat until too small update
      if (delta <= minDelta) {
        break;
      }
    }
    // up both ends
    teamDiffLayer[0].up(0);
    teamDiffLayer[teamDiffLen - 1].up(1);
    // up the remainder of the black arrows
    for (const f of teamPerfLayer) {
      for (const x of _.range(f.vars.length - 1)) {
        f.up(x);
      }
    }
    for (const f of perfLayer) {
      f.up();
    }
    return layers;
  }
}

/**
 * A shortcut to rate just 2 players in a head-to-head match
 */
export function rate_1vs1(
  rating1: Rating,
  rating2: Rating,
  drawn = false,
  minDelta = DELTA,
  env?: TrueSkill,
): [Rating, Rating] {
  if (!env) {
    env = global_env();
  }
  const ranks = [0, drawn ? 0 : 1];
  const teams = env.rate([[rating1], [rating2]], ranks, undefined, minDelta);
  return [teams[0][0], teams[1][0]];
}

/**
 * A shortcut to calculate the match quality between 2 players in
 * a head-to-head match
 */
export function quality_1vs1(
  rating1: Rating,
  rating2: Rating,
  env?: TrueSkill,
) {
  if (!env) {
    env = global_env();
  }
  return env.quality([[rating1], [rating2]]);
}
/**
 * Gets the `TrueSkill` object which is the global environment.
 */
export function global_env(): TrueSkill {
  if (trueskill) {
    return trueskill;
  }
  setup();
  return trueskill;
}

/**
 * Setup the global environment defaults
 */
export function setup(
  mu: number | null = MU,
  sigma: number | null = SIGMA,
  beta: number | null = BETA,
  tau: number | null = TAU,
  drawProbability: number | null = DRAW_PROBABILITY,
  env?: TrueSkill,
) {
  if (!env) {
    env = new TrueSkill(mu, sigma, beta, tau, drawProbability);
  }
  trueskill = env;
  return env;
}

/**
 * A proxy function for `TrueSkill.rate` of the global environment.
 */
export function rate(
  ratingGroups: Rating[][] | any[],
  ranks?: any[] | null,
  weights?: any[] | null,
  minDelta = DELTA,
): Rating[][] {
  return global_env().rate(ratingGroups, ranks, weights, minDelta);
}

export function winProbability(a: Rating[], b: Rating[]) {
  return global_env().winProbability(a, b);
}

/**
 * A proxy function for `TrueSkill.quality` of the global
 * environment.
 */
export function quality(ratingGroups: Rating[][] | any[], weights?: number[][]) {
  return global_env().quality(ratingGroups, weights);
}

/**
 * A proxy function for TrueSkill.expose of the global environment.
 */
export function expose(rating: Rating) {
  return global_env().expose(rating);
}

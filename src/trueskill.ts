import { add, det, exp, inv, matrix, matrix as mMatrix, multiply, transpose } from 'mathjs';
import { Gaussian } from 'ts-gaussian';

import { LikelihoodFactor, PriorFactor, SumFactor, TruncateFactor, Variable } from './factorgraph';
import { Rating } from './rating';

/**
 * Calculates a draw-margin from the given drawProbability
 */
export function calcDrawMargin(drawProbability: number, size: number, env = new TrueSkill()) {
  return env.guassian.ppf((drawProbability + 1) / 2) * Math.sqrt(size) * env.beta;
}

/**
 * Makes a size map of each teams.
 */
function _teamSizes(ratingGroups: Rating[][]) {
  const teamSizes = [0];
  ratingGroups.map(group => teamSizes.push(group.length + teamSizes[teamSizes.length - 1]));
  teamSizes.shift();
  return teamSizes;
}

/**
 * Implements a TrueSkill environment.  An environment could have
 * customized constants.  Every games have not same design and may need to
 * customize TrueSkill constants.
 *
 * For example, 60% of matches in your game have finished as draw then you
 * should set ``draw_probability`` to 0.60
 *
 * const env = new TrueSkill(undefined, undefined, undefined, undefined, 0.6);
 *
 * For more details of the constants, see [The Math Behind TrueSkill by
 * Jeff Moser](http://www.moserware.com/assets/computing-your-skill/The%20Math%20Behind%20TrueSkill.pdf).
 */
export class TrueSkill {
  mu: number;
  sigma: number;
  beta: number;
  tau: number;

  /**
   * @param mu initial mean of ratings
   * @param sigma initial standard deviation of ratings
   * @param beta distance that guarantees about 76% chance of winning
   * @param tau dynamic factor
   * @param drawProbability draw probability of the game
   * @param guassian reuseable gaussian
   */
  constructor(
    mu = 25,
    sigma?: number,
    beta?: number,
    tau?: number,
    public drawProbability = 0.1,
    public guassian = new Gaussian(0, 1),
  ) {
    this.mu = mu;
    this.sigma = sigma ?? this.mu / 3;
    this.beta = beta ?? this.sigma / 2;
    this.tau = tau ?? this.sigma / 100;
  }

  /**
   * Recalculates ratings by the ranking table
   */
  rate(
    ratingGroups: Rating[][] | any[],
    ranks: number[] | null = null,
    weights: number[][] | null = null,
    minDelta = 0.0001,
  ): Rating[][] | any[] {
    const [newRatingGroups, keys] = this._validateRatingGroups(ratingGroups);
    weights = this._validateWeights(newRatingGroups, weights);
    const groupSize = ratingGroups.length;
    if (ranks && ranks.length !== groupSize) {
      throw new Error('Wrong ranks');
    }

    const newRanks = ranks ? ranks : Array.from({ length: groupSize }, (_, i) => i);
    // Sort rating groups by rank
    const zip: Array<[Rating[], number, number[]]> = [];
    for (let idx = 0; idx < newRatingGroups.length; idx++) {
      zip.push([newRatingGroups[idx], newRanks[idx], weights[idx]]);
    }

    let position = 0;
    const positions = zip.map(el => {
      const res: [number, [Rating[], number, number[]]] = [position, el];
      position++;
      return res;
    });
    const sorting = positions.sort((a, b) => a[1][1] - b[1][1]);
    const sortedRatingGroups: Rating[][] = [];
    const sortedRanks: number[] = [];
    const sortedWeights: number[][] = [];
    for (const [x, [g, r, w]] of sorting) {
      sortedRatingGroups.push(g);
      sortedRanks.push(r);
      // Make weights to be greater than 0
      const max = w.map((ww: number) => Math.max(minDelta, ww));
      sortedWeights.push(max);
    }

    // Build factor graph
    const flattenRatings = sortedRatingGroups.flat();
    const flattenWeights = sortedWeights.flat();
    const size = flattenRatings.length;
    // Create variables
    const fill = Array.from({ length: size });
    const ratingVars = fill.map(() => new Variable());
    const perfVars = fill.map(() => new Variable());
    const teamPerfVars = Array.from({ length: groupSize }).map(() => new Variable());
    const teamDiffVars = Array.from({ length: groupSize - 1 }).map(() => new Variable());
    const teamSizes = _teamSizes(sortedRatingGroups);
    // Layer builders
    const layers = this._runSchedule(
      ratingVars,
      flattenRatings,
      perfVars,
      teamPerfVars,
      teamSizes,
      flattenWeights,
      teamDiffVars,
      sortedRanks,
      sortedRatingGroups,
      minDelta,
    );
    const transformedGroups: Rating[][] = [];
    const trimmed = [0].concat(teamSizes.slice(0, teamSizes.length - 1));
    for (let idx = 0; idx < teamSizes.length; idx++) {
      const group = layers
        .slice(trimmed[idx], teamSizes[idx])
        .map((f: PriorFactor) => new Rating(f.v.mu, f.v.sigma));
      transformedGroups.push(group);
    }

    const pulledTranformedGroups: Array<[number, Rating[]]> = [];
    for (let idx = 0; idx < sorting.length; idx++) {
      pulledTranformedGroups.push([sorting[idx][0], transformedGroups[idx]]);
    }

    const unsorting = pulledTranformedGroups.sort((a, b) => a[0] - b[0]);
    if (!keys) {
      return unsorting.map(k => k[1]);
    }

    return unsorting.map(v => {
      return { [keys[v[0]][0]]: v[1][0] };
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
  quality(ratingGroups: Rating[][], weights?: number[][]): number {
    function createVarianceMatrix(flattenRatings: Rating[], height: number, width: number) {
      const matrix = mMatrix().resize([height, width]);
      const variances = flattenRatings.map(r => r.sigma ** 2);
      for (let i = 0; i < variances.length; i++) {
        matrix.set([i, i], variances[i]);
      }

      return matrix;
    }

    function createRotatedAMatrix(newRatingGroups: Rating[][], flattenWeights: number[]) {
      let t = 0;
      let r = 0;
      const matrix = mMatrix();
      for (let i = 0; i < newRatingGroups.length - 1; i++) {
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        const setter = Array.from({ length: newRatingGroups[i].length }, (_, n) => n + t).map(z => {
          matrix.set([r, z], flattenWeights[z]);
          t += 1;
          return z;
        });
        const x = setter[setter.length - 1] + 1;
        for (let d = x; d < newRatingGroups[i + 1].length + x; d++) {
          matrix.set([r, d], -flattenWeights[d]);
        }

        r++;
      }

      return matrix;
    }

    const [newRatingGroups, _keys] = this._validateRatingGroups(ratingGroups);
    const newWeights = this._validateWeights(ratingGroups, weights);
    const flattenRatings = ratingGroups.flat();
    const flattenWeights = newWeights.flat();
    const { length } = flattenRatings;
    // A vector of all of the skill means
    const meanMatrix = matrix(flattenRatings.map(r => [r.mu]));
    const varianceMatrix = createVarianceMatrix(flattenRatings, length, length);
    const rotatedAMatrix = createRotatedAMatrix(newRatingGroups, flattenWeights);
    const aMatrix = transpose(rotatedAMatrix);
    // Match quality further derivation
    const modifiedRotatedAMatrix = rotatedAMatrix.map(
      (value: number, _: any, __: any) => this.beta ** 2 * value,
    );
    const start = multiply(transpose(meanMatrix), aMatrix);
    const ata = multiply(modifiedRotatedAMatrix, aMatrix);
    const atsa = multiply(rotatedAMatrix, multiply(varianceMatrix, aMatrix));
    const middle: any = add(ata, atsa);
    const end = multiply(rotatedAMatrix, meanMatrix);
    // Make result
    const eArg = det(multiply(multiply([[-0.5]], multiply(start, inv(middle))), end));
    const sArg = det(ata) / det(middle);
    return exp(eArg) * Math.sqrt(sArg);
  }

  /**
   * Initializes new `Rating` object, but it fixes default mu and
   * sigma to the environment's.
   * var env = TrueSkill(mu=0, sigma=1)
   * var env.createRating()
   * trueskill.Rating(mu=0.000, sigma=1.000)
   */
  createRating(mu = this.mu, sigma = this.sigma): Rating {
    return new Rating(mu, sigma);
  }

  /**
   * Returns the value of the rating exposure.  It starts from 0 and
   * converges to the mean.  Use this as a sort key in a leaderboard
   */
  expose(rating: Rating): number {
    const k = this.mu / this.sigma;
    return rating.mu - k * rating.sigma;
  }

  /**
   * Taken from https://github.com/sublee/trueskill/issues/1
   */
  winProbability(a: Rating[], b: Rating[]): number {
    const deltaMu = a.reduce((t, cur) => t + cur.mu, 0) - b.reduce((t, cur) => t + cur.mu, 0);
    const sumSigma =
      a.reduce((t, n) => n.sigma ** 2 + t, 0) + b.reduce((t, n) => n.sigma ** 2 + t, 0);
    const playerCount = a.length + b.length;
    const denominator = Math.sqrt(playerCount * (this.beta * this.beta + sumSigma));
    return this.guassian.cdf(deltaMu / denominator);
  }

  /**
   * The non-draw version of "V" function.
   * "V" calculates a variation of a mean.
   */
  private _vWin(diff: number, drawMargin: number) {
    const x = diff - drawMargin;
    const denom = this.guassian.cdf(x);
    return denom ? this.guassian.pdf(x) / denom : -x;
  }

  private _vDraw(diff: number, drawMargin: number) {
    const absDiff = Math.abs(diff);
    const [a, b] = [drawMargin - absDiff, -drawMargin - absDiff];
    const denom = this.guassian.cdf(a) - this.guassian.cdf(b);
    const numer = this.guassian.pdf(b) - this.guassian.pdf(a);
    return (denom ? numer / denom : a) * (diff < 0 ? -1 : +1);
  }

  /**
   * The non-draw version of "W" function.
   * "W" calculates a variation of a standard deviation.
   */
  private _wWin(diff: number, drawMargin: number) {
    const x = diff - drawMargin;
    const v = this._vWin(diff, drawMargin);
    const w = v * (v + x);
    if (w > 0 && w < 1) {
      return w;
    }

    throw new Error('floating point error');
  }

  /**
   * The draw version of "W" function.
   */
  private _wDraw(diff: number, drawMargin: number) {
    const absDiff = Math.abs(diff);
    const a = drawMargin - absDiff;
    const b = -drawMargin - absDiff;
    const denom = this.guassian.cdf(a) - this.guassian.cdf(b);
    if (!denom) {
      throw new Error('Floating point error');
    }

    const v = this._vDraw(absDiff, drawMargin);
    return v ** 2 + (a * this.guassian.pdf(a) - b * this.guassian.pdf(b)) / denom;
  }

  /**
   * Validates a ratingGroups argument. It should contain more than
   * 2 groups and all groups must not be empty.
   */
  private _validateRatingGroups(ratingGroups: Rating[][] | any[]): [Rating[][], string[][] | null] {
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
        const keyGroup = Object.keys(dictRatingGroup);
        const ratingGroup: Rating[] = keyGroup.map(n => dictRatingGroup[n] as Rating);
        newRatingGroups.push(ratingGroup);
        keys.push(keyGroup);
      }

      return [newRatingGroups, keys];
    }

    return [ratingGroups, null];
  }

  private _validateWeights(ratingGroups: Rating[][], weights?: number[][] | null): number[][] {
    if (!weights) {
      return ratingGroups.map(n => Array(n.length).fill(1));
    }

    return weights;
  }

  private _buildRatingLayer(ratingVars: Variable[], flattenRatings: Rating[]) {
    const t = this.tau;
    return ratingVars.map((n, idx) => new PriorFactor(n, flattenRatings[idx], t));
  }

  private _buildPerfLayer(ratingVars: Variable[], perfVars: Variable[]) {
    const b = this.beta ** 2;
    return ratingVars.map((n, idx) => new LikelihoodFactor(n, perfVars[idx], b));
  }

  private _buildTeamPerfLayer(
    teamPerfVars: Variable[],
    perfVars: Variable[],
    teamSizes: number[],
    flattenWeights: number[],
  ) {
    let team = 0;
    return teamPerfVars.map(teamPerfVar => {
      const start = team > 0 ? teamSizes[team - 1] : 0;
      const end = teamSizes[team];
      team += 1;
      return new SumFactor(
        teamPerfVar,
        perfVars.slice(start, end),
        flattenWeights.slice(start, end),
      );
    });
  }

  private _buildTeamDiffLayer(teamPerfVars: Variable[], teamDiffVars: Variable[]) {
    let team = 0;
    return teamDiffVars.map(teamDiffVar => {
      const sl = teamPerfVars.slice(team, team + 2);
      team++;
      return new SumFactor(teamDiffVar, sl, [1, -1]);
    });
  }

  private _buildTruncLayer(
    teamDiffVars: Variable[],
    sortedRanks: number[],
    sortedRatingGroups: Rating[][],
  ) {
    let x = 0;
    return teamDiffVars.map(teamDiffVar => {
      // Static draw probability
      const { drawProbability } = this;
      const lengths = sortedRatingGroups.slice(x, x + 2).map(n => n.length);
      const drawMargin = calcDrawMargin(
        drawProbability,
        lengths.reduce((t, n) => t + n, 0),
        this,
      );
      let vFunc = (a: number, b: number) => this._vWin(a, b);
      let wFunc = (a: number, b: number) => this._wWin(a, b);
      if (sortedRanks[x] === sortedRanks[x + 1]) {
        vFunc = (a, b) => this._vDraw(a, b);
        wFunc = (a, b) => this._wDraw(a, b);
      }

      x++;
      return new TruncateFactor(teamDiffVar, vFunc, wFunc, drawMargin);
    });
  }

  /**
   * Sends messages within every nodes of the factor graph
   * until the result is reliable.
   */
  private _runSchedule(
    ratingVars: Variable[],
    flattenRatings: Rating[],
    perfVars: Variable[],
    teamPerfVars: Variable[],
    teamSizes: number[],
    flattenWeights: number[],
    teamDiffVars: Variable[],
    sortedRanks: number[],
    sortedRatingGroups: Rating[][],
    minDelta = 0.0001,
  ) {
    if (minDelta <= 0) {
      throw new Error('minDelta must be greater than 0');
    }

    const ratingLayer = this._buildRatingLayer(ratingVars, flattenRatings);
    const perfLayer = this._buildPerfLayer(ratingVars, perfVars);
    const teamPerfLayer = this._buildTeamPerfLayer(
      teamPerfVars,
      perfVars,
      teamSizes,
      flattenWeights,
    );
    ratingLayer.map(f => f.down());
    perfLayer.map(f => f.down());
    teamPerfLayer.map(f => f.down());
    // Arrow #1, #2, #3
    const teamDiffLayer = this._buildTeamDiffLayer(teamPerfVars, teamDiffVars);
    const truncLayer = this._buildTruncLayer(teamDiffVars, sortedRanks, sortedRatingGroups);
    const teamDiffLen = teamDiffLayer.length;
    for (let index = 0; index <= 10; index++) {
      let delta = 0;
      if (teamDiffLen === 1) {
        // Only two teams
        teamDiffLayer[0].down();
        delta = truncLayer[0].up();
      } else {
        // Multiple teams
        delta = 0;
        for (let z = 0; z < teamDiffLen - 1; z++) {
          teamDiffLayer[z].down();
          delta = Math.max(delta, truncLayer[z].up());
          teamDiffLayer[z].up(1);
        }

        for (let z = teamDiffLen - 1; z > 0; z--) {
          teamDiffLayer[z].down();
          delta = Math.max(delta, truncLayer[z].up());
          teamDiffLayer[z].up(0);
        }
      }

      // Repeat until too small update
      if (delta <= minDelta) {
        break;
      }
    }

    // Up both ends
    teamDiffLayer[0].up(0);
    teamDiffLayer[teamDiffLen - 1].up(1);
    // Up the remainder of the black arrows
    for (const f of teamPerfLayer) {
      for (let x = 0; x < f.vars.length - 1; x++) {
        f.up(x);
      }
    }

    for (const f of perfLayer) {
      f.up();
    }

    return ratingLayer;
  }
}

/**
 * A shortcut to rate just 2 players in a head-to-head match
 */
export function rate_1vs1(
  rating1: Rating,
  rating2: Rating,
  drawn = false,
  minDelta = 0.0001,
  env: TrueSkill = new TrueSkill(),
): [Rating, Rating] {
  const ranks = [0, drawn ? 0 : 1];
  const teams = env.rate([[rating1], [rating2]], ranks, undefined, minDelta);
  return [teams[0][0] as Rating, teams[1][0] as Rating];
}

/**
 * A shortcut to calculate the match quality between 2 players in
 * a head-to-head match
 */
export function quality_1vs1(rating1: Rating, rating2: Rating, env: TrueSkill = new TrueSkill()) {
  return env.quality([[rating1], [rating2]]);
}

/**
 * A proxy function for `TrueSkill.rate` of the global environment.
 */
export function rate(
  ratingGroups: Rating[][] | any[],
  ranks?: any[] | null,
  weights?: any[] | null,
  minDelta = 0.0001,
  env: TrueSkill = new TrueSkill(),
): Rating[][] {
  return env.rate(ratingGroups, ranks, weights, minDelta);
}

export function winProbability(a: Rating[], b: Rating[], env: TrueSkill = new TrueSkill()) {
  return env.winProbability(a, b);
}

/**
 * A proxy function for `TrueSkill.quality` of the global
 * environment.
 */
export function quality(
  ratingGroups: Rating[][] | any[],
  weights?: number[][],
  env: TrueSkill = new TrueSkill(),
) {
  return env.quality(ratingGroups, weights);
}

/**
 * A proxy function for TrueSkill.expose of the global environment.
 */
export function expose(rating: Rating, env: TrueSkill = new TrueSkill()) {
  return env.expose(rating);
}

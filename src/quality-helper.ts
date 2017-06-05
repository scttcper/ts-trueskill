import * as _ from 'lodash';
import * as math from 'mathjs';

import { Rating } from './rating';

export function VarianceMatrix(
  flattenRatings: Rating[],
  height: number,
  width: number,
) {
  const matrix = math.matrix().resize([height, width]);
  const variances = flattenRatings.map((r) => r.sigma ** 2);
  for (let i = 0; i < variances.length; i++) {
    matrix.set([i, i], variances[i]);
  }
  return matrix;
}

export function RotatedAMatrix(
  newRatingGroups: Rating[][],
  flattenWeights: number[],
) {
  let t = 0;
  let r = 0;
  const matrix = math.matrix();
  for (let i = 0; i < newRatingGroups.length - 1; i++) {
    let x = 0;
    for (x of _.range(t, t + newRatingGroups[i].length)) {
      matrix.set([r, x], flattenWeights[x]);
      t += 1;
    }
    x += 1;
    _.range(x, x + newRatingGroups[i + 1].length)
      .map((d) => matrix.set([r, d], -flattenWeights[d]));
    r++;
  }
  return matrix;
}

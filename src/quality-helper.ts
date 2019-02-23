import { matrix as mMatrix } from 'mathjs';

import { Rating } from './rating';

export function createVarianceMatrix(
  flattenRatings: Rating[],
  height: number,
  width: number,
) {
  const matrix = mMatrix().resize([height, width]);
  const variances = flattenRatings.map(r => r.sigma ** 2);
  for (let i = 0; i < variances.length; i++) {
    matrix.set([i, i], variances[i]);
  }

  return matrix;
}

export function createRotatedAMatrix(
  newRatingGroups: Rating[][],
  flattenWeights: number[],
) {
  let t = 0;
  let r = 0;
  const matrix = mMatrix();
  for (let i = 0; i < newRatingGroups.length - 1; i++) {
    const setter = Array.from(
      { length: newRatingGroups[i].length },
      (_, n) => n + t,
    ).map(z => {
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

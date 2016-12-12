import { expect } from 'chai';
import * as _ from 'lodash';

import { Rating, TrueSkill, rate } from '../src/index';
import { Gaussian, Matrix } from '../src/mathematics';

// function generate_teams(sizes, env = null) {
//   const ratingCls = env ? env.createRating : Rating;
//   return sizes.map((size) => {
//     const ratingGroups = _.range(size).map(() => ratingCls());
//     return ratingGroups;
//   });
// }
// def generate_teams(sizes, env=None):
//     rating_cls = Rating if env is None else env.create_rating
//     rating_groups = []
//     for size in sizes:
//         ratings = []
//         for x in range(size):
//             ratings.append(rating_cls())
//         rating_groups.append(tuple(ratings))
//     return rating_groups
//
describe('TrueSkill', function () {
  it('should create rating', function (done) {
    const [r1, r2, r3] = [new Rating(),  new Rating(), new Rating()];
    const rated = rate([[r1, r2], [r3]]);
    expect(rated.length).to.eq(2);
    expect(rated[0]).to.be.instanceof(Array);
    expect(rated[1]).to.be.instanceof(Array);
    expect(rated[0]).length.to.eq(2);
    expect(rated[1]).length.to.eq(1);
  });
});

// describe('Gaussian', function () {
//   it('should validate sigma argument is needed', function (done) {
//     try {
//       const a = new Gaussian(0);
//     } catch (e) {
//       expect(e).to.be.instanceOf(TypeError);
//       done();
//     }
//   });
//   it('should validate sigma**2 should be greater than 0', function (done) {
//     try {
//       const a = new Gaussian(0, 0);
//     } catch (e) {
//       expect(e).to.be.instanceOf(Error);
//       done();
//     }
//   });
// });
//
// describe('Matrix', function () {
//   it('test matrix operations', function (done) {
//     // expect(new Matrix([[1, 2], [3, 4]])).inverse()
//     done();
//   });
// });

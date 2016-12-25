import { expect } from 'chai';
import * as _ from 'lodash';

import { Rating, TrueSkill, rate, setup, quality } from '../src/index';
import { Gaussian, Matrix } from '../src/mathematics';

function generateTeams(sizes: number[], env?) {
  return sizes.map((size) => {
    if (env) {
      return _.range(size).map(() => env.createRating());
    }
    return _.range(size).map(() => new Rating());
  });
}

describe('TrueSkill', function () {
  it('should create rating', function (done) {
    const [team1, team2] = generateTeams([5, 5]);
    const rated = rate([team1, team2]);
    expect(rated.length).to.eq(2);
    expect(rated[0]).to.be.instanceof(Array);
    expect(rated[1]).to.be.instanceof(Array);
    expect(rated[0].length).to.eq(5);
    expect(rated[1].length).to.eq(5);
    const rated2 = rate([rated[1], rated[0]]);
    done();
  });
  it('should rate unsorted groups', function(done) {
    const [t1, t2, t3] = generateTeams([1, 1, 1]);
    const rated = rate([t1, t2, t3], [2, 1, 0]);
    expect(rated[0][0].val()[0]).to.be.closeTo(18.325, 0.01);
    expect(rated[0][0].val()[1]).to.be.closeTo(6.656, 0.01);
    expect(rated[1][0].val()[0]).to.be.closeTo(25.000, 0.01);
    expect(rated[1][0].val()[1]).to.be.closeTo(6.208, 0.01);
    expect(rated[2][0].val()[0]).to.be.closeTo(31.675, 0.01);
    expect(rated[2][0].val()[1]).to.be.closeTo(6.656, 0.01);
    done();
  });
  it('should use custom environment', function(done) {
    const env = new TrueSkill(null, null, null, null, 0.50);
    const [t1, t2] = generateTeams([1, 1], env);
    const rated = env.rate([t1, t2]);
    expect(rated[0][0].val()[0]).to.be.closeTo(30.267, 0.01);
    expect(rated[0][0].val()[1]).to.be.closeTo(7.077, 0.01);
    expect(rated[1][0].val()[0]).to.be.closeTo(19.733, 0.01);
    expect(rated[1][0].val()[1]).to.be.closeTo(7.077, 0.01);
    done();
  });
  it('should use global environment', function(done) {
    setup(null, null, null, null, 0.50);
    const [t1, t2] = generateTeams([1, 1]);
    const rated = rate([t1, t2]);
    expect(rated[0][0].val()[0]).to.be.closeTo(30.267, 0.01);
    expect(rated[0][0].val()[1]).to.be.closeTo(7.077, 0.01);
    expect(rated[1][0].val()[0]).to.be.closeTo(19.733, 0.01);
    expect(rated[1][0].val()[1]).to.be.closeTo(7.077, 0.01);
    setup();
    done();
  });
  it('should test quality', function(done) {
    // 1 vs 1
    let [t1, t2] = generateTeams([1, 1]);
    const q = quality([t1, t2]);
    expect(q).to.be.closeTo(0.447, 0.01);
    let [[x], [y]] = rate([t1, t2]);
    expect(x.mu).to.be.closeTo(29.396, 0.01);
    expect(x.sigma).to.be.closeTo(7.171, 0.01);
    expect(y.mu).to.be.closeTo(20.604, 0.01);
    expect(y.sigma).to.be.closeTo(7.171, 0.01);
    // 1 vs 1 draw
    [[x], [y]] = rate([t1, t2], [0, 0]);
    expect(x.mu).to.be.closeTo(25.000, 0.01);
    expect(x.sigma).to.be.closeTo(6.458, 0.01);
    expect(y.mu).to.be.closeTo(25.000, 0.01);
    expect(y.sigma).to.be.closeTo(6.458, 0.01);
    // 2 vs 2
    // [t1, t2] = generateTeams([2, 2]);
    // [[x], [y]] = rate([t1, t2], [0, 0]);
    // expect(x.mu).to.be.closeTo(25.000, 0.01);
    // expect(x.sigma).to.be.closeTo(6.458, 0.01);
    // expect(y.mu).to.be.closeTo(25.000, 0.01);
    // expect(y.sigma).to.be.closeTo(6.458, 0.01);
    done();
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

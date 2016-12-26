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
    let p1, p2, p3, p4, p5, p6, p7, p8;
    // 1 vs 1
    let [t1, t2] = generateTeams([1, 1]);
    let q = quality([t1, t2]);
    expect(q).to.be.closeTo(0.447, 0.01);
    [[p1], [p2]] = rate([t1, t2]);
    expect(p1.mu).to.be.closeTo(29.396, 0.01);
    expect(p1.sigma).to.be.closeTo(7.171, 0.01);
    expect(p2.mu).to.be.closeTo(20.604, 0.01);
    expect(p2.sigma).to.be.closeTo(7.171, 0.01);
    // 1 vs 1 draw
    [[p1], [p2]] = rate([t1, t2], [0, 0]);
    expect(p1.mu).to.be.closeTo(25.000, 0.01);
    expect(p1.sigma).to.be.closeTo(6.458, 0.01);
    expect(p2.mu).to.be.closeTo(25.000, 0.01);
    expect(p2.sigma).to.be.closeTo(6.458, 0.01);
    // 2 vs 2
    [t1, t2] = generateTeams([2, 2]);
    q = quality([t1, t2]);
    expect(q).to.be.closeTo(0.447, 0.01);
    let [rt1, rt2] = rate([t1, t2]);
    expect(rt1.length).to.eq(2);
    expect(rt2.length).to.eq(2);
    for (let p of rt1) {
      expect(p.mu).to.be.closeTo(28.108, 0.01);
      expect(p.sigma).to.be.closeTo(7.774, 0.01);
    }
    for (let p of rt2) {
      expect(p.mu).to.be.closeTo(21.892, 0.01);
      expect(p.sigma).to.be.closeTo(7.774, 0.01);
    }
    // 2 vs 2 draw
    [rt1, rt2] = rate([t1, t2], [0, 0]);
    expect(rt1.length).to.eq(2);
    expect(rt2.length).to.eq(2);
    for (let p of rt1) {
      expect(p.mu).to.be.closeTo(25.000, 0.01);
      expect(p.sigma).to.be.closeTo(7.455, 0.01);
    }
    for (let p of rt2) {
      expect(p.mu).to.be.closeTo(25.000, 0.01);
      expect(p.sigma).to.be.closeTo(7.455, 0.01);
    }
    // 4 vs 4
    [t1, t2] = generateTeams([4, 4]);
    q = quality([t1, t2]);
    expect(q).to.be.closeTo(0.447, 0.01);
    [rt1, rt2] = rate([t1, t2]);
    expect(rt1.length).to.eq(4);
    expect(rt2.length).to.eq(4);
    for (let p of rt1) {
      expect(p.mu).to.be.closeTo(27.198, 0.01);
      expect(p.sigma).to.be.closeTo(8.059, 0.01);
    }
    for (let p of rt2) {
      expect(p.mu).to.be.closeTo(22.802, 0.01);
      expect(p.sigma).to.be.closeTo(8.059, 0.01);
    }
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

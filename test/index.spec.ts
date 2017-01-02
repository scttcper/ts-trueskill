import { expect } from 'chai';
import * as _ from 'lodash';

import {
  quality,
  quality_1vs1,
  rate, rate_1vs1,
  Rating,
  setup,
  TrueSkill,
} from '../src/index';
import { Gaussian } from '../src/mathematics';

function generateTeams(sizes: number[], env?) {
  return sizes.map((size) => {
    const r = new Array(size).fill(0);
    if (env) {
      return r.map(() => env.createRating());
    }
    return r.map(() => new Rating());
  });
}

function generateIndividual(size, env?) {
  return generateTeams(Array(size).fill(1), env);
}

function compareRating(result: Rating[][], expected: number[][]) {
  const res = _.flatten(result);
  expect(result).to.be.instanceof(Array);
  for (let team = 0; team < res.length; team++) {
    expect(res[team].mu).to.be.closeTo(expected[team][0], 0.01);
    expect(res[team].sigma).to.be.closeTo(expected[team][1], 0.01);
  }
}

describe('TrueSkill', function () {
  it('should create rating', function () {
    const [team1, team2] = generateTeams([5, 5]);
    const rated = rate([team1, team2]);
    expect(rated.length).to.eq(2);
    expect(rated[0]).to.be.instanceof(Array);
    expect(rated[1]).to.be.instanceof(Array);
    expect(rated[0].length).to.eq(5);
    expect(rated[1].length).to.eq(5);
  });
  it('should rate unsorted groups', function() {
    const [t1, t2, t3] = generateTeams([1, 1, 1]);
    const rated = rate([t1, t2, t3], [2, 1, 0]);
    compareRating(
      rated,
      [[18.325, 6.656], [25.000, 6.208], [31.675, 6.656]],
    );
  });
  it('should use custom environment', function() {
    const env = new TrueSkill(null, null, null, null, 0.50);
    const [t1, t2] = generateTeams([1, 1], env);
    const rated = env.rate([t1, t2]);
    compareRating(
      rated,
      [[30.267, 7.077], [19.733, 7.077]],
    );
  });
  it('should use global environment', function() {
    setup(null, null, null, null, 0.50);
    const [t1, t2] = generateTeams([1, 1]);
    const rated = rate([t1, t2]);
    compareRating(
      rated,
      [[30.267, 7.077], [19.733, 7.077]],
    );
    setup();
  });
  it('should test n vs n', function() {
    // 1 vs 1
    let teams = generateTeams([1, 1]);
    expect(quality(teams)).to.be.closeTo(0.447, 0.01);
    compareRating(
      rate(teams),
      [[29.396, 7.171], [20.604, 7.171]],
    );
    // 1 vs 1 draw
    compareRating(
      rate(teams, [0, 0]),
      [[25.000, 6.458], [25.000, 6.458]],
    );
    // 2 vs 2
    teams = generateTeams([2, 2]);
    expect(quality(teams)).to.be.closeTo(0.447, 0.01);
    compareRating(
      rate(teams),
      [[28.108, 7.774], [28.108, 7.774], [21.892, 7.774], [21.892, 7.774]],
    );
    // 2 vs 2 draw
    compareRating(
      rate(teams, [0, 0]),
      [[25.000, 7.455], [25.000, 7.455], [25.000, 7.455], [25.000, 7.455]],
    );
    // 4 vs 4
    teams = generateTeams([4, 4]);
    expect(quality(teams)).to.be.closeTo(0.447, 0.01);
    compareRating(
      rate(teams),
      [[27.198, 8.059], [27.198, 8.059], [27.198, 8.059], [27.198, 8.059],
        [22.802, 8.059], [22.802, 8.059], [22.802, 8.059], [22.802, 8.059]],
    );
  });
  it('should test 1 vs n', function() {
    const [t1] = generateTeams([1]);
    // 1 vs 2
    let [t2] = generateTeams([2]);
    expect(quality([t1, t2])).to.be.closeTo(0.135, 0.01);
    compareRating(
      rate([t1, t2]),
      [[33.730, 7.317], [16.270, 7.317], [16.270, 7.317]],
    );
    compareRating(
      rate([t1, t2], [0, 0]),
      [[31.660, 7.138], [18.340, 7.138], [18.340, 7.138]],
    );
    // 1 vs 3
    [t2] = generateTeams([3]);
    expect(quality([t1, t2])).to.be.closeTo(0.012, 0.01);
    compareRating(
      rate([t1, t2]),
      [[36.337, 7.527], [13.663, 7.527], [13.663, 7.527], [13.663, 7.527]],
    );
    compareRating(
      rate([t1, t2]),
      [[36.337, 7.527], [13.663, 7.527], [13.663, 7.527], [13.663, 7.527]],
    );
    compareRating(
      rate([t1, t2], [0, 0]),
      [[34.990, 7.455], [15.010, 7.455], [15.010, 7.455], [15.010, 7.455]],
    );
    // 1 vs 7
    [t2] = generateTeams([7]);
    expect(quality([t1, t2])).to.be.closeTo(0, 0.01);
    compareRating(
      rate([t1, t2]),
      [[40.582, 7.917], [9.418, 7.917], [9.418, 7.917], [9.418, 7.917],
        [9.418, 7.917], [9.418, 7.917], [9.418, 7.917], [9.418, 7.917]],
    );
  });
  it('should test individual', function() {
    // 3 players
    let players = generateIndividual(3);
    expect(quality(players)).to.closeTo(0.200, 0.001);
    compareRating(
      rate(players),
      [[31.675, 6.656], [25.000, 6.208], [18.325, 6.656]],
    );
    compareRating(
      rate(players, Array(players.length).fill(0)),
      [[25.000, 5.698], [25.000, 5.695], [25.000, 5.698]],
    );
    // 4 players
    players = generateIndividual(4);
    expect(quality(players)).to.closeTo(0.089, 0.001);
    compareRating(
      rate(players),
      [[33.207, 6.348], [27.401, 5.787], [22.599, 5.787], [16.793, 6.348]],
    );
    // 5 players
    players = generateIndividual(5);
    expect(quality(players)).to.closeTo(0.040, 0.001);
    compareRating(
      rate(players),
      [[34.363, 6.136], [29.058, 5.536], [25.000, 5.420], [20.942, 5.536],
        [15.637, 6.136]],
    );
    // 8 players draw
    players = generateIndividual(8);
    expect(quality(players)).to.closeTo(0.004, 0.001);
    compareRating(
      rate(players, Array(players.length).fill(0))  ,
      [[25.000, 4.592], [25.000, 4.583], [25.000, 4.576], [25.000, 4.573],
        [25.000, 4.573], [25.000, 4.576], [25.000, 4.583], [25.000, 4.592]],
    );
    // 16 players
    players = generateIndividual(16);
    compareRating(
      rate(players),
      [[40.539, 5.276], [36.810, 4.711], [34.347, 4.524], [32.336, 4.433],
        [30.550, 4.380], [28.893, 4.349], [27.310, 4.330], [25.766, 4.322],
        [24.234, 4.322], [22.690, 4.330], [21.107, 4.349], [19.450, 4.380],
        [17.664, 4.433], [15.653, 4.524], [13.190, 4.711], [9.461, 5.276]],
    );
  });
  it('should test multiple teams', function() {
    // 2 vs 4 vs 2
    let t1 = [new Rating(40, 4), new Rating(45, 3)];
    let t2 = [new Rating(20, 7), new Rating(19, 6), new Rating(30, 9), new Rating(10, 4)];
    let t3 = [new Rating(50, 5), new Rating(30, 2)];
    expect(quality([t1, t2, t3])).to.closeTo(0.367, 0.001);
    compareRating(
      rate([t1, t2, t3], [0, 1, 1]),
      [[40.877, 3.840], [45.493, 2.934], [19.609, 6.396], [18.712, 5.625],
        [29.353, 7.673], [9.872, 3.891], [48.830, 4.590], [29.813, 1.976]],
    );
    // 1 vs 2 vs 1
    t1 = [new Rating()];
    t2 = [new Rating(), new Rating()];
    t3 = [new Rating()];
    expect(quality([t1, t2, t3])).to.closeTo(0.047, 0.001);
  });
  it('should test upset', function() {
    // 1 vs 1
    let t1 = [new Rating()];
    let t2 = [new Rating(50, 12.5)];
    expect(quality([t1, t2])).to.closeTo(0.110, 0.001);
    compareRating(
      rate([t1, t2], [0, 0]),
      [[31.662, 7.137], [35.010, 7.910]],
    );
    // 2 vs 2
    t1 = [new Rating(20, 8), new Rating(25, 6)];
    t2 = [new Rating(35, 7), new Rating(40, 5)];
    expect(quality([t1, t2])).to.closeTo(0.084, 0.001);
    compareRating(
      rate([t1, t2]),
      [[29.698, 7.008], [30.455, 5.594], [27.575, 6.346], [36.211, 4.768]],
    );
    // 3 vs 2
    t1 = [new Rating(28, 7), new Rating(27, 6), new Rating(26, 5)];
    t2 = [new Rating(30, 4), new Rating(31, 3)];
    expect(quality([t1, t2])).to.closeTo(0.254, 0.001);
    compareRating(
      rate([t1, t2], [0, 1]),
      [[28.658, 6.770], [27.484, 5.856], [26.336, 4.917], [29.785, 3.958],
        [30.879, 2.983]],
    );
    compareRating(
      rate([t1, t2], [1, 0]),
      [[21.840, 6.314], [22.474, 5.575], [22.857, 4.757], [32.012, 3.877],
        [32.132, 2.949]],
    );
    // 8 players
    const players = [
      [new Rating(10, 8)], [new Rating(15, 7)], [new Rating(20, 6)],
      [new Rating(25, 5)], [new Rating(30, 4)], [new Rating(35, 3)],
      [new Rating(40, 2)], [new Rating(45, 1)],
    ];
    expect(quality(players)).to.closeTo(0.000, 0.001);
    compareRating(
      rate(players),
      [[35.135, 4.506], [32.585, 4.037], [31.329, 3.756], [30.984, 3.453],
        [31.751, 3.064], [34.051, 2.541], [38.263, 1.849], [44.118, 0.983]],
    );
  });
  it('should test partial play', function() {
    const t1 = [new Rating()];
    const t2 = [new Rating(), new Rating()];
    expect(rate([t1, t2], null, [[1], [1, 1]])).to.deep.eq(rate([t1, t2]));
    compareRating(
      rate([t1, t2], null, [[1], [1, 1]]),
      [[33.730, 7.317], [16.270, 7.317], [16.270, 7.317]],
    );
    compareRating(
      rate([t1, t2], null, [[0.5], [0.5, 0.5]]),
      [[33.939, 7.312], [16.061, 7.312], [16.061, 7.312]],
    );
    compareRating(
      rate([t1, t2], null, [[1], [0, 1]]),
      [[29.440, 7.166], [25.000, 8.333], [20.560, 7.166]],
    );
    compareRating(
      rate([t1, t2], null, [[1], [0.5, 1]]),
      [[32.417, 7.056], [21.291, 8.033], [17.583, 7.056]],
    );
    // match quality of partial play
    const t3 = [new Rating()];
    expect(quality([t1, t2, t3], [[1], [0.25, 0.75], [1]])).to.closeTo(0.2, 0.001);
    expect(quality([t1, t2, t3], [[1], [0.8, 0.9], [1]])).to.closeTo(0.0809, 0.001);
  });
  it('should test microsoft reasearch example', function() {
    // http://research.microsoft.com/en-us/projects/trueskill/details.aspx
    const rated = rate([
      {alice: new Rating()},
      {bob: new Rating()},
      {chris: new Rating()},
      {darren: new Rating()},
      {eve: new Rating()},
      {fabien: new Rating()},
      {george: new Rating()},
      {hillary: new Rating()},
    ]);
    let r: any = {};
    rated.forEach((n) => {
      r = _.merge(r, n);
    });
    expect(r.alice.mu).to.be.closeTo(36.771, 0.001);
    expect(r.alice.sigma).to.be.closeTo(5.749, 0.001);
    expect(r.bob.mu).to.be.closeTo(32.242, 0.001);
    expect(r.bob.sigma).to.be.closeTo(5.133, 0.001);
    expect(r.chris.mu).to.be.closeTo(29.074, 0.001);
    expect(r.chris.sigma).to.be.closeTo(4.943, 0.001);
    expect(r.darren.mu).to.be.closeTo(26.322, 0.001);
    expect(r.darren.sigma).to.be.closeTo(4.874, 0.001);
    expect(r.eve.mu).to.be.closeTo(23.678, 0.001);
    expect(r.eve.sigma).to.be.closeTo(4.874, 0.001);
    expect(r.fabien.mu).to.be.closeTo(20.926, 0.001);
    expect(r.fabien.sigma).to.be.closeTo(4.943, 0.001);
    expect(r.george.mu).to.be.closeTo(17.758, 0.001);
    expect(r.george.sigma).to.be.closeTo(5.133, 0.001);
    expect(r.hillary.mu).to.be.closeTo(13.229, 0.001);
    expect(r.hillary.sigma).to.be.closeTo(5.749, 0.001);
  });
  it('should test 1vs1 shortcuts', function() {
    const [p1, p2] = rate_1vs1(new Rating(), new Rating());
    expect(p1.mu).to.be.closeTo(29.396, 0.001);
    expect(p1.sigma).to.be.closeTo(7.171, 0.001);
    expect(p2.mu).to.be.closeTo(20.604, 0.001);
    expect(p2.sigma).to.be.closeTo(7.171, 0.001);
    const quality = quality_1vs1(new Rating(), new Rating());
    expect(quality).to.be.closeTo(0.447, 0.01);
  });
});

describe('Gaussian', function () {
  it('should test valid gaussian', function () {
    const fn = () => new Gaussian(0);
    expect(fn).to.throw(TypeError);
    const fn1 = () => new Gaussian(0, 0);
    expect(fn1).to.throw(Error);
  });
});

describe('Rating', function () {
  it('should print Rating', function () {
    expect(new Rating().toString()).to.eq('Rating(mu=25.000, sigma=8.333)');
  });
});

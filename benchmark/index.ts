import Benchmark from 'benchmark';

import { quality, rate, Rating, TrueSkill } from '../src/index.js';

const ts = new TrueSkill();

function generateTeams(sizes: number[], env?: TrueSkill) {
  return sizes.map(size => {
    const r = new Array(size).fill(0);
    if (env) {
      return r.map(() => env.createRating());
    }

    return r.map(() => new Rating());
  });
}

const suite = new Benchmark.Suite();
suite
  .add('5 vs 5', () => {
    const [team1, team2] = generateTeams([5, 5], ts);
    rate([team1, team2]);
  })
  .on('cycle', (event: any) => {
    console.log(String(event.target));
  })
  .run({ async: true });

const suite2 = new Benchmark.Suite();
suite2
  .add('quality 5 vs 5', () => {
    const [team1, team2] = generateTeams([5, 5], ts);
    quality([team1, team2]);
  })
  .on('cycle', (event: any) => {
    console.log(String(event.target));
  })
  .run({ async: true });

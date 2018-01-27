/* tslint:disable:no-implicit-dependencies */
import * as Benchmark from 'benchmark';
import * as _ from 'lodash';
import {
  quality,
  quality_1vs1,
  rate,
  rate_1vs1,
  setup,
  winProbability,
  Rating,
  TrueSkill,
} from '../src';

function generateTeams(sizes: number[], env?: TrueSkill) {
  return sizes.map(size => {
    const r = Array(size).fill(0);
    if (env) {
      return r.map(() => env.createRating());
    }
    return r.map(() => new Rating());
  });
}

function generateIndividual(size: number) {
  return generateTeams(Array(size).fill(1));
}

const suite = new Benchmark.Suite();
suite
  .add('5 vs 5', () => {
    const [team1, team2] = generateTeams([5, 5]);
    const rated = rate([team1, team2]);
  })
  .on('cycle', (event: any) => {
    console.log(String(event.target));
  })
  .run({ async: true });

const suite2 = new Benchmark.Suite();
suite2
  .add('quality 5 vs 5', () => {
    const [team1, team2] = generateTeams([5, 5]);
    const rated = quality([team1, team2]);
  })
  .on('cycle', (event: any) => {
    console.log(String(event.target));
  })
  .run({ async: true });

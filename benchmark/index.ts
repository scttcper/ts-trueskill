import * as Benchmark from 'benchmark';
import * as _ from 'lodash';
import {
  quality,
  quality_1vs1,
  rate,
  rate_1vs1,
  setup,
  TrueSkill,
  winProbability,
} from '../build/index';
import { Rating } from '../build/rating';

function generateTeams(sizes: number[], env?: TrueSkill) {
  return sizes.map((size) => {
    const r = _.fill(Array(size), 0);
    if (env) {
      return r.map(() => env.createRating());
    }
    return r.map(() => new Rating());
  });
}

function generateIndividual(size: number) {
  return generateTeams(_.fill(Array(size), 1));
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

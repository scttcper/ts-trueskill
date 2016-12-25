# ts-trueskill
[![build status][build-img]][build-url]
[![coverage status][coverage-img]][coverage-url]

[build-img]: https://img.shields.io/travis/scttcper/ts-trueskill.svg
[build-url]: https://travis-ci.org/scttcper/ts-trueskill
[coverage-img]: https://codecov.io/gh/scttcper/ts-trueskill/branch/master/graph/badge.svg
[coverage-url]: https://codecov.io/gh/scttcper/ts-trueskill

TypeScript port of the python TrueSkill package by Heungsub Lee https://github.com/sublee/trueskill

### What's TrueSkill
[TrueSkill](http://research.microsoft.com/en-us/projects/trueskill) is a rating system among game players. It was developed by Microsoft Research and has been used on Xbox LIVE for ranking and matchmaking service. This system quantifies players’ TRUE skill points by the Bayesian inference algorithm. It also works well with any type of match rule including N:N team game or free-for-all.

### Installation
```bash
npm install ts-trueskill
```

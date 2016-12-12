# ts-trueskill
[![Dependency Status][david-img]][david-url]
[![build status][travis-img]][travis-url]
[![coverage status][coveralls-img]][coveralls-url]

[david-img]: https://img.shields.io/david/scttcper/ts-trueskill.svg
[david-url]: https://david-dm.org/scttcper/ts-trueskill
[travis-img]: https://img.shields.io/travis/scttcper/ts-trueskill.svg
[travis-url]: https://travis-ci.org/scttcper/ts-trueskill
[coveralls-img]: https://img.shields.io/coveralls/scttcper/ts-trueskill.svg
[coveralls-url]: https://coveralls.io/github/scttcper/ts-trueskill?branch=master

TypeScript port of the python TrueSkill package by Heungsub Lee https://github.com/sublee/trueskill

### What's TrueSkill
[TrueSkill](http://research.microsoft.com/en-us/projects/trueskill) is a rating system among game players. It was developed by Microsoft Research and has been used on Xbox LIVE for ranking and matchmaking service. This system quantifies players’ TRUE skill points by the Bayesian inference algorithm. It also works well with any type of match rule including N:N team game or free-for-all.

### Installation
```bash
npm install ts-trueskill
```

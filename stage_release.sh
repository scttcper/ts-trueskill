#!/usr/bin/env bash
set -exu

rm -rf build
npm run build
cp package.json build
cp README.md build
cp LICENSE build

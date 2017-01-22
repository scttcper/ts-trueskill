#!/usr/bin/env bash
set -exu

npm run build
cp package.json build
cp README.md build
cp LICENSE build

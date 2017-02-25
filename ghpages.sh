#!/bin/bash

if [[ $TRAVIS_BRANCH != 'master' ]]; then
	# Not master branch aborting
	exit 0
fi
yarn docs
yarn global add gh-pages
echo "Pushing to github pages"
git config --global user.email "$PUSH_EMAIL"
git config --global user.name "Travis CI"
gh-pages -r "https://$PUSH_TOKEN@github.com/$TRAVIS_REPO_SLUG.git" -d docs -x -t

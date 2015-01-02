#!/bin/bash

rev=$(git rev-parse --short HEAD)

cd dist

git init
git config user.name "Alex LaFroscia"
git config user.email "alex@lafroscia.com"

git remote add upstream "https://$GH_TOKEN@github.com/alexlafroscia/asteravoid"
git fetch upstream && git reset upstream/gh-pages

touch .

git add -A .
git commit -m "Rebuild pages at ${rev}"
git push -q upstream HEAD:gh-pages

#!/bin/bash
# Run this once to push MK DOC to GitHub
# Usage: bash scripts/push-to-github.sh

set -e

REPO_URL="https://shimgetgoal:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/shimgetgoal/mkdigitalsystem-operationscenter.git"

echo "Adding GitHub remote..."
git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"

echo "Setting branch to main..."
git branch -M main

echo "Pushing to GitHub..."
git push -u origin main

echo "Done! Check https://github.com/shimgetgoal/mkdigitalsystem-operationscenter"

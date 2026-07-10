#!/bin/bash
set -e

REPO="https://shimgetgoal:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/shimgetgoal/MK-software-inventory-system.git"

echo "Setting remote..."
git remote set-url origin "$REPO" 2>/dev/null || git remote add origin "$REPO"

echo "Pushing to GitHub (bypassing credential helper)..."
GIT_TERMINAL_PROMPT=0 git -c credential.helper="" push -u origin main --force

echo ""
echo "Done! https://github.com/shimgetgoal/MK-software-inventory-system"

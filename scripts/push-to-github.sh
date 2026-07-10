#!/bin/bash
set -e

REPO_URL="https://shimgetgoal:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/shimgetgoal/MK-software-inventory-system.git"

echo "Setting remote..."
git remote set-url origin "$REPO_URL" 2>/dev/null || git remote add origin "$REPO_URL"

echo "Pushing to GitHub..."
git push -u origin main --force

echo ""
echo "Done! View at: https://github.com/shimgetgoal/MK-software-inventory-system"

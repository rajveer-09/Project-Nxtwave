#!/usr/bin/env bash
#
# Author : Rajveer Sharma
# Date : 17 Nov 2026
# @ Nxtwave
#
# Clones the whole Student Hub repository (every branch) and installs its dependencies.
#
#   bash clone.sh [folder] [--branch master|staging] [--no-install]
#
#   folder         where to clone (default: Project-Nxtwave)
#   --branch       branch to check out (default: master)
#   --no-install   clone only, skip installing dependencies
#
# The repository is private: sign in first with `gh auth login` (GitHub CLI), or let Git
# ask for your GitHub credentials. Standalone, so it can be downloaded on its own:
#
#   gh api repos/lakshayysinghh/Project-Nxtwave/contents/scripts/clone.sh \
#     -H "Accept: application/vnd.github.raw" > clone.sh && bash clone.sh
#
# Windows: scripts\clone.cmd does the same from PowerShell or cmd.

set -euo pipefail

REPO="lakshayysinghh/Project-Nxtwave"
TARGET="Project-Nxtwave"
BRANCH="master"
INSTALL=1

while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="${2:?--branch needs a name}"; shift 2 ;;
    --no-install) INSTALL=0; shift ;;
    -h|--help) sed -n '7,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) TARGET="$1"; shift ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

have git || { echo "Git is required: https://git-scm.com/downloads" >&2; exit 1; }
if [ -e "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
  echo "$TARGET already exists and isn't empty. Pick another folder: bash clone.sh <folder>" >&2
  exit 1
fi

bold "Cloning $REPO into $TARGET"
if have gh && gh auth status >/dev/null 2>&1; then
  gh repo clone "$REPO" "$TARGET"
else
  git clone "https://github.com/$REPO.git" "$TARGET"
fi
cd "$TARGET"

# A local branch for every remote branch (master, staging, ...)
git fetch --quiet origin
for remote in $(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin); do
  [ "$remote" = HEAD ] && continue
  git show-ref --verify --quiet "refs/heads/$remote" || git branch --quiet --track "$remote" "origin/$remote"
done
git checkout --quiet "$BRANCH"
bold "Branches: $(git for-each-ref --format='%(refname:short)' refs/heads | tr '\n' ' ')(on $BRANCH)"

if [ "$INSTALL" = 1 ]; then
  if [ -f scripts/start.sh ]; then
    bash scripts/start.sh --install-only
  else
    echo "This branch has no scripts/start.sh yet; skipped installing dependencies." >&2
  fi
fi

bold "Done. Next:"
echo "  cd $TARGET"
echo "  scripts/start.sh          (Windows: scripts\\start.cmd)"

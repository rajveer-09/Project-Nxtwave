#!/usr/bin/env bash
#
# Author : Rajveer Sharma
# Date : 17 Nov 2026
# @ Nxtwave
#
# Clones the whole Student Hub repository (every branch) and installs its dependencies.
# Run it again on a folder it already cloned to bring that copy up to date with GitHub.
#
#   bash clone.sh [folder] [--branch master|staging] [--no-install]
#
#   folder         where to clone (default: Project-Nxtwave)
#   --branch       branch to check out (default: master; when updating, the one you're on)
#   --no-install   skip installing dependencies
#
# Updating fetches every branch, adds new ones, and fast-forwards the ones that are behind.
# Your own work is never overwritten: a branch with commits that aren't on GitHub, or with
# uncommitted changes in the way, is left as it is and reported.
#
# The repository is private: sign in first with `gh auth login` (GitHub CLI), or let Git
# ask for your GitHub credentials. Standalone, so it can be downloaded on its own:
#
#   gh api repos/lakshayysinghh/Project-Nxtwave/contents/infra/scripts/clone.sh \
#     -H "Accept: application/vnd.github.raw" > clone.sh && bash clone.sh
#
# Windows: infra\scripts\clone.cmd does the same from PowerShell or cmd.

set -euo pipefail

REPO="lakshayysinghh/Project-Nxtwave"
TARGET="Project-Nxtwave"
BRANCH=""
INSTALL=1

while [ $# -gt 0 ]; do
  case "$1" in
    --branch) BRANCH="${2:?--branch needs a name}"; shift 2 ;;
    --no-install) INSTALL=0; shift ;;
    -h|--help) sed -n '7,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) TARGET="$1"; shift ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }
# True when the folder is a clone of this repository.
is_clone() { git -C "$1" remote get-url origin 2>/dev/null | grep -qi "github.com[:/]$REPO\(\.git\)\{0,1\}$"; }

have git || { echo "Git is required: https://git-scm.com/downloads" >&2; exit 1; }

if [ -d "$TARGET" ] && is_clone "$TARGET"; then
  bold "Updating $TARGET from GitHub"
  cd "$TARGET"
  git fetch --quiet --prune origin
  [ -n "$BRANCH" ] || BRANCH="$(git symbolic-ref --quiet --short HEAD || echo master)"
else
  if [ -e "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
    echo "$TARGET already exists, isn't empty and isn't a clone of $REPO. Pick another folder: bash clone.sh <folder>" >&2
    exit 1
  fi
  bold "Cloning $REPO into $TARGET"
  if have gh && gh auth status >/dev/null 2>&1; then
    gh repo clone "$REPO" "$TARGET"
  else
    git clone "https://github.com/$REPO.git" "$TARGET"
  fi
  cd "$TARGET"
  git fetch --quiet origin
  [ -n "$BRANCH" ] || BRANCH="master"
fi

# A local branch for every remote branch (master, staging, ...); fast-forward the ones behind.
current="$(git symbolic-ref --quiet --short HEAD || true)"
for remote in $(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin); do
  [ "$remote" = HEAD ] && continue
  if ! git show-ref --verify --quiet "refs/heads/$remote"; then
    git branch --quiet --track "$remote" "origin/$remote"
  elif [ "$remote" != "$current" ]; then
    if git merge-base --is-ancestor "$remote" "origin/$remote"; then
      git update-ref "refs/heads/$remote" "refs/remotes/origin/$remote"
    else
      warn "$remote has commits that aren't on GitHub; left as it is."
    fi
  fi
done

git checkout --quiet "$BRANCH"
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git merge --ff-only --quiet "origin/$BRANCH" ||
    warn "$BRANCH couldn't be brought up to date (uncommitted changes in the way, or commits that aren't on GitHub). Commit or stash them, then run: git pull"
fi
bold "Branches: $(git for-each-ref --format='%(refname:short)' refs/heads | tr '\n' ' ')(on $BRANCH, $(git log -1 --format='%h %s'))"

if [ "$INSTALL" = 1 ]; then
  if [ -f infra/scripts/start.sh ]; then
    bash infra/scripts/start.sh --install-only
  else
    echo "This branch has no infra/scripts/start.sh yet; skipped installing dependencies." >&2
  fi
fi

bold "Done. Next:"
echo "  cd $TARGET"
echo "  infra/scripts/start.sh          (Windows: infra\scripts\start.cmd)"

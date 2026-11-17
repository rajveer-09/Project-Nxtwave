@echo off
rem
rem Author : Rajveer Sharma
rem Date : 17 Nov 2026
rem @ Nxtwave
rem
rem Clones the whole Student Hub repository (every branch) and installs its dependencies.
rem Usage: clone.cmd [folder] [branch]        defaults: Project-Nxtwave master
rem The repository is private: sign in first with "gh auth login", or Git will ask for your
rem GitHub credentials. Needs only Git, so it can be downloaded and run on its own.
setlocal
set "REPO=lakshayysinghh/Project-Nxtwave"
set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=Project-Nxtwave"
set "BRANCH=%~2"
if "%BRANCH%"=="" set "BRANCH=master"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is required: https://git-scm.com/download/win
  exit /b 1
)
if exist "%TARGET%\" (
  dir /b /a "%TARGET%" | findstr . >nul && (
    echo %TARGET% already exists and is not empty. Pick another folder: clone.cmd ^<folder^>
    exit /b 1
  )
)

echo Cloning %REPO% into %TARGET%
set "USE_GH="
where gh >nul 2>nul && gh auth status >nul 2>nul && set "USE_GH=1"
if defined USE_GH (
  gh repo clone %REPO% "%TARGET%"
) else (
  git clone "https://github.com/%REPO%.git" "%TARGET%"
)
if errorlevel 1 exit /b 1
cd /d "%TARGET%"

rem A local branch for every remote branch (master, staging, ...)
git fetch --quiet origin
for /f "delims=" %%B in ('git for-each-ref "--format=%%(refname:strip=3)" refs/remotes/origin') do (
  if not "%%B"=="HEAD" (
    git show-ref --verify --quiet "refs/heads/%%B" || git branch --quiet --track "%%B" "origin/%%B"
  )
)
git checkout --quiet %BRANCH%
if errorlevel 1 exit /b 1

if exist scripts\start.cmd (
  call scripts\start.cmd --install-only
) else (
  echo This branch has no scripts\start.cmd yet; skipped installing dependencies.
)
echo.
echo Done. Next:
echo   cd %TARGET%
echo   scripts\start.cmd

@echo off
rem
rem Author : Rajveer Sharma
rem Date : 17 Nov 2026
rem @ Nxtwave
rem
rem Clones the whole Student Hub repository (every branch) and installs its dependencies.
rem Run it again on a folder it already cloned to bring that copy up to date with GitHub:
rem every branch is fetched, new ones are added and the ones behind are fast-forwarded.
rem Your own work is never overwritten; a branch that can't be fast-forwarded is reported.
rem Usage: clone.cmd [folder] [branch] [--no-install]
rem   defaults: Project-Nxtwave, master (when updating, the branch you're on)
rem The repository is private: sign in first with "gh auth login", or Git will ask for your
rem GitHub credentials. Needs only Git, so it can be downloaded and run on its own.
setlocal
set "REPO=lakshayysinghh/Project-Nxtwave"
set "TARGET="
set "BRANCH="
set "INSTALL=1"
:args
if "%~1"=="" goto argsdone
if /i "%~1"=="--no-install" (
  set "INSTALL="
) else if not defined TARGET (
  set "TARGET=%~1"
) else (
  set "BRANCH=%~1"
)
shift
goto args
:argsdone
if "%TARGET%"=="" set "TARGET=Project-Nxtwave"

where git >nul 2>nul
if errorlevel 1 (
  echo Git is required: https://git-scm.com/download/win
  exit /b 1
)

set "UPDATE="
if exist "%TARGET%\.git\" (
  git -C "%TARGET%" remote get-url origin 2>nul | findstr /i /r /c:"github.com[:/]%REPO%" >nul && set "UPDATE=1"
)
if defined UPDATE goto update

if exist "%TARGET%\" (
  dir /b /a "%TARGET%" | findstr . >nul && (
    echo %TARGET% already exists, is not empty and is not a clone of %REPO%. Pick another folder: clone.cmd ^<folder^>
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
git fetch --quiet origin
if "%BRANCH%"=="" set "BRANCH=master"
goto branches

:update
echo Updating %TARGET% from GitHub
cd /d "%TARGET%"
git fetch --quiet --prune origin
if errorlevel 1 exit /b 1
if "%BRANCH%"=="" for /f "delims=" %%C in ('git symbolic-ref --quiet --short HEAD 2^>nul') do set "BRANCH=%%C"
if "%BRANCH%"=="" set "BRANCH=master"

:branches
rem A local branch for every remote branch (master, staging, ...); fast-forward the ones behind.
set "CURRENT="
for /f "delims=" %%C in ('git symbolic-ref --quiet --short HEAD 2^>nul') do set "CURRENT=%%C"
for /f "delims=" %%B in ('git for-each-ref "--format=%%(refname:strip=3)" refs/remotes/origin') do call :sync "%%B"

git checkout --quiet %BRANCH%
if errorlevel 1 exit /b 1
git show-ref --verify --quiet "refs/remotes/origin/%BRANCH%"
if not errorlevel 1 (
  git merge --ff-only --quiet "origin/%BRANCH%"
  if errorlevel 1 echo %BRANCH% could not be brought up to date: uncommitted changes in the way, or commits that are not on GitHub. Commit or stash them, then run: git pull
)
for /f "delims=" %%L in ('git log -1 "--format=%%h %%s"') do echo On %BRANCH%: %%L

if not defined INSTALL (
  rem skipped: --no-install
) else if exist infra\scripts\start.cmd (
  call infra\scripts\start.cmd --install-only
) else (
  echo This branch has no infra\scripts\start.cmd yet; skipped installing dependencies.
)
echo.
echo Done. Next:
echo   cd %TARGET%
echo   infra\scripts\start.cmd
exit /b 0

:sync
set "B=%~1"
if "%B%"=="HEAD" exit /b 0
git show-ref --verify --quiet "refs/heads/%B%"
if errorlevel 1 (
  git branch --quiet --track "%B%" "origin/%B%"
  exit /b 0
)
if "%B%"=="%CURRENT%" exit /b 0
git merge-base --is-ancestor "%B%" "origin/%B%"
if errorlevel 1 (
  echo %B% has commits that are not on GitHub; left as it is.
  exit /b 0
)
git update-ref "refs/heads/%B%" "refs/remotes/origin/%B%"
exit /b 0

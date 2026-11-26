@echo off
rem
rem Author : Rajveer Sharma
rem Date : 26 Nov 2026
rem @ Nxtwave
rem
rem Windows launcher for infra/scripts/contest-worker.sh (the LeetCode scan worker), run with the Git Bash that comes with Git for Windows.
rem Usage: infra\scripts\contest-worker.cmd   (Ctrl+C stops it)
setlocal
call :find_bash || exit /b 1
set "SCRIPT=%~dp0contest-worker.sh"
set "SCRIPT=%SCRIPT:\=/%"
"%GIT_BASH%" "%SCRIPT%" %*
exit /b %ERRORLEVEL%

:find_bash
set "GIT_BASH="
for /f "delims=" %%G in ('where git.exe 2^>nul') do if not defined GIT_BASH call :try "%%~dpG"
if not defined GIT_BASH if exist "%ProgramFiles%\Git\bin\bash.exe" set "GIT_BASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined GIT_BASH (
  echo Git Bash was not found. Install Git for Windows: https://git-scm.com/download/win
  exit /b 1
)
exit /b 0

:try
rem git.exe lives in <Git>\cmd, <Git>\bin or <Git>\mingw64\bin
for %%R in ("%~1.." "%~1..\..") do if not defined GIT_BASH if exist "%%~fR\bin\bash.exe" set "GIT_BASH=%%~fR\bin\bash.exe"
exit /b 0

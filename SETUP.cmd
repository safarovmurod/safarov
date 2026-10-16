@echo off
setlocal DisableDelayedExpansion
title Antigravity Portable Setup
powershell.exe -NoLogo -NoProfile -File "%~dp0scripts\bootstrap.ps1" -Mode Setup
set "RESULT=%ERRORLEVEL%"
echo.
echo Final exit code: %RESULT%
if not "%RESULT%"=="0" echo If PowerShell policy blocked scripts, setup made no changes. Security policy was not weakened.
echo Press any key to close.
pause >nul
exit /b %RESULT%

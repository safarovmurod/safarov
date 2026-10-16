@echo off
setlocal DisableDelayedExpansion
title Antigravity Read-Only Diagnostics
powershell.exe -NoLogo -NoProfile -File "%~dp0scripts\bootstrap.ps1" -Mode Diagnostics
set "RESULT=%ERRORLEVEL%"
echo.
echo Diagnostics exit code: %RESULT%
pause
exit /b %RESULT%

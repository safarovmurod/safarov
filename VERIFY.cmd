@echo off
setlocal DisableDelayedExpansion
title Antigravity Read-Only Verification
powershell.exe -NoLogo -NoProfile -File "%~dp0scripts\bootstrap.ps1" -Mode Verify
set "RESULT=%ERRORLEVEL%"
echo.
echo Verification exit code: %RESULT%
pause
exit /b %RESULT%

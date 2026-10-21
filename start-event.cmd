@echo off
REM Double-click to start the Cydemic CTF platform for the event.
REM Reads WEB_PORT and secrets from .env (run "npm run prod:init" once first).
cd /d "%~dp0"
echo Starting Cydemic CTF (production)...
call npm run start:prod
echo.
echo The server has stopped. Press any key to close this window.
pause >nul

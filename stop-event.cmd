@echo off
REM Double-click to stop the Cydemic CTF platform and every challenge service.
cd /d "%~dp0"
echo Stopping Cydemic CTF...
call npm run stop:prod
echo.
echo Done. Press any key to close this window.
pause >nul

@echo off
title Bandwidth Monitor
echo ========================================
echo   Bandwidth Monitor - Starting...
echo ========================================
echo.

cd /d "%~dp0"

:: Open browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

:: Start the app
python app.py

pause

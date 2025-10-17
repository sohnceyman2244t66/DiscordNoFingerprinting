@echo off
echo ==========================================
echo   Discord Secure Launcher - Starting...
echo ==========================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

:: Start the application
echo Launching Discord Secure Launcher...
npm start

pause
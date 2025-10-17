@echo off
echo ==========================================
echo   Discord Secure Launcher - Build Script
echo ==========================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

:: Clean previous builds
if exist "dist" (
    echo Cleaning previous build...
    rmdir /s /q dist
    echo.
)

:: Set environment variable to skip code signing
set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

:: Build the application
echo Building Discord Secure Launcher (Portable Version)...
call npm run build

echo.
echo ==========================================
echo   Build Complete!
echo   Check the 'dist' folder for the portable exe
echo ==========================================

pause
@echo off
echo ========================================================
echo TeamBee Automated Deployer to Render
echo ========================================================
cd /d "%~dp0"

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%b
if "%CURRENT_BRANCH%"=="" set CURRENT_BRANCH=main

echo 1. Pushing branch %CURRENT_BRANCH% to GitHub...
git push origin "%CURRENT_BRANCH%"

echo.
echo 2. Executing Render Deployment Engine...
set RENDER_BRANCH=%CURRENT_BRANCH%
node deploy_render.js

echo.
pause

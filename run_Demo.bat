@echo off
cd /d "%~dp0"
node scripts\prepare-demo-assets.mjs
if errorlevel 1 exit /b 1
node node_modules\vite\bin\vite.js build --config demo\vite.config.mts
if errorlevel 1 exit /b 1
node node_modules\vite\bin\vite.js preview --config demo\vite.config.mts

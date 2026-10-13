@echo off
cd /d "%~dp0"
node node_modules\next\dist\bin\next dev --hostname 127.0.0.1

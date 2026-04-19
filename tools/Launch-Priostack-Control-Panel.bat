@echo off
setlocal
set "SCRIPT=%~dp0Priostack-Control-Panel.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SCRIPT%"

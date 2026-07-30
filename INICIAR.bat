@echo off
title Calendario NEUROCOOP
color 0B
echo.
echo  Cerrando instancias anteriores...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM ngrok.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul
echo.
echo  ==========================================
echo     CALENDARIO NEUROCOOP - Iniciando...
echo     Puerto base: 8765
echo  ==========================================
echo.
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" server.js
pause

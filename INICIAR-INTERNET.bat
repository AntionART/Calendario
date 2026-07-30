@echo off
title Calendario NEUROCOOP - Internet
color 0B
cd /d "C:\Users\AuxSistemas\Desktop\CALENDARIO"

cls
echo.
echo  ==========================================
echo   CALENDARIO NEUROCOOP - Modo Internet
echo  ==========================================
echo.
echo  Cerrando procesos anteriores...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM ngrok.exe /T >nul 2>&1
taskkill /F /IM cloudflared.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo  Iniciando servidor Node.js...
start "Servidor NEUROCOOP" C:\PROGRA~1\nodejs\node.exe server.js
timeout /t 6 /nobreak >nul

echo  Conectando tunel ngrok...
start "ngrok NEUROCOOP" /min "C:\ngrok\ngrok.exe" start calendario
timeout /t 10 /nobreak >nul

cls
echo.
echo  ============================================================
echo   CALENDARIO NEUROCOOP - ACTIVO
echo  ============================================================
echo   LOCAL:
echo     http://localhost:8765/
echo     Admin: http://localhost:8765/gestion
echo  ============================================================
echo   INTERNET - URL FIJA:
echo     Usuarios: https://unsoldierlike-izayah-tetchily.ngrok-free.dev
echo     Admin:    https://unsoldierlike-izayah-tetchily.ngrok-free.dev/gestion
echo  ============================================================
echo   Contrasena admin: neurocoop2024
echo  ============================================================
echo   Reinicio automatico si el tunel falla.
echo   Cierre esta ventana para detener todo.
echo  ============================================================
echo.

:vigilar
timeout /t 15 /nobreak >nul
tasklist /FI "IMAGENAME eq ngrok.exe" 2>nul | find /I "ngrok.exe" >nul
if errorlevel 1 (
  echo  [%TIME%] Tunel caido - reiniciando ngrok...
  start "ngrok NEUROCOOP" /min "C:\ngrok\ngrok.exe" start calendario
)
goto :vigilar

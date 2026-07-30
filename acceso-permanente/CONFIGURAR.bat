@echo off
title Configuracion Acceso Permanente - CALENDARIO NEUROCOOP
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  Solicitando permisos de Administrador...
    PowerShell -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0configurar.ps1""' -Verb RunAs -Wait"
    exit
)
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar.ps1"

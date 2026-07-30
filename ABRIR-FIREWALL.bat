@echo off
:: Ejecutar como Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  ERROR: Ejecute este archivo como Administrador.
    echo  Clic derecho en el archivo - Ejecutar como administrador
    echo.
    pause
    exit /b 1
)

echo.
echo  Configurando Firewall de Windows para puerto 8765...

:: Eliminar reglas antiguas (3030 y 8765) si existen
netsh advfirewall firewall delete rule name="Calendario NEUROCOOP" >nul 2>&1

:: Agregar regla para puerto 8765
netsh advfirewall firewall add rule name="Calendario NEUROCOOP" dir=in action=allow protocol=TCP localport=8765

if %errorLevel% equ 0 (
    echo.
    echo  EXITO: Puerto 8765 abierto en el Firewall de Windows.
    echo  Los equipos en la misma red ya pueden acceder
    echo  al calendario usando la IP de este servidor.
    echo.
) else (
    echo  ERROR al configurar el firewall.
)
pause

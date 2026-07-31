#Requires -Version 5.0
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$CAL_DIR   = "c:\Users\AuxSistemas\Desktop\CALENDARIO"
$ngrokCfg  = "$env:USERPROFILE\AppData\Local\ngrok\ngrok.yml"
$startupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

Write-Host ""
Write-Host "  CONFIGURAR DOMINIO ESTATICO DE NGROK" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Pasos:" -ForegroundColor Yellow
Write-Host "  1. En el navegador que se abrio -> 'New Domain' -> 'Create'"
Write-Host "  2. Le dan un dominio como: xxxx.ngrok-free.app"
Write-Host "  3. Ingrese ese dominio aqui abajo"
Write-Host ""
$staticDomain = Read-Host "  Dominio estatico (ej: magical-hen.ngrok-free.app)"
if (-not $staticDomain) { exit }
$staticDomain = $staticDomain.Trim()

$cfg = Get-Content $ngrokCfg -Raw
$newCfg = "version: `"3`"`nagent:`n    authtoken: 3BV28FWJ66E9lsT4jX8Yvg7jCtW_6waSNTq8vkbaLprRWQggt`n`ntunnels:`n  calendario:`n    proto: http`n    addr: 8765`n    domain: $staticDomain`n"
$newCfg | Set-Content $ngrokCfg -Encoding utf8
Write-Host "  [OK] Config actualizado" -ForegroundColor Green

$ngrokStartup = "@echo off`ntimeout /t 5 /nobreak >nul`nstart `"`" /min `"C:\ngrok\ngrok.exe`" start calendario"
$ngrokStartup | Set-Content "$startupDir\calendario-tunel.bat" -Encoding ascii

Stop-Process -Name ngrok -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-Process "node.exe" -ArgumentList "server.js" -WorkingDirectory $CAL_DIR -NoNewWindow
Start-Sleep -Seconds 4
Start-Process "C:\ngrok\ngrok.exe" -ArgumentList "start calendario" -NoNewWindow
Start-Sleep -Seconds 5

$newUrl = (Invoke-WebRequest "http://localhost:4040/api/tunnels" -UseBasicParsing -ErrorAction SilentlyContinue | ConvertFrom-Json).tunnels[0].public_url

Write-Host ""
Write-Host "  URL PERMANENTE:" -ForegroundColor Green
Write-Host "    Portal: $newUrl" -ForegroundColor Green
Write-Host "    Admin:  $newUrl/gestion" -ForegroundColor Green
Write-Host ""
Write-Host "  Esta URL NUNCA cambia. Compartala con Pamplona y Ocana." -ForegroundColor White
Write-Host ""
Read-Host "  ENTER para cerrar"

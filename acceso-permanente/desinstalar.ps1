#Requires -RunAsAdministrator
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$CAL_DIR     = Split-Path -Parent $SCRIPT_DIR
$CF_INST_DIR = "C:\Program Files\Cloudflared"
$CF_SYS_DIR  = "C:\Windows\System32\config\systemprofile\.cloudflared"
$CF_BIN      = "$CF_INST_DIR\cloudflared.exe"
$TASK_NAME   = "Calendario NEUROCOOP"

Write-Host ""
Write-Host "  ═══════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  DESINSTALAR ACCESO PERMANENTE - CALENDARIO NEUROCOOP" -ForegroundColor Yellow
Write-Host "  ═══════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "  Esto detendra el acceso por internet permanente. Continuar? [s/n]"
if ($confirm -notin @("s","S","si","SI")) {
    Write-Host "  Cancelado." -ForegroundColor Gray
    Read-Host "  Presione ENTER para salir"
    exit
}

Write-Host ""

Write-Host "  Deteniendo servicio Cloudflare Tunnel..." -ForegroundColor Gray
Stop-Service "Cloudflare Tunnel" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

if (Test-Path $CF_BIN) {
    & $CF_BIN service uninstall 2>&1 | Out-Null
    Write-Host "  [OK] Servicio Cloudflare Tunnel eliminado" -ForegroundColor Green
}

$cfgFile = "$SCRIPT_DIR\config.json"
if (Test-Path $cfgFile) {
    $cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
    $localCF = "$CAL_DIR\cloudflared.exe"
    if (Test-Path $localCF -and $cfg.tunnelName) {
        Write-Host "  Eliminando tunel '$($cfg.tunnelName)' de Cloudflare..." -ForegroundColor Gray
        & $localCF tunnel delete $cfg.tunnelName 2>&1 | Write-Host
        Write-Host "  [OK] Tunel eliminado de Cloudflare" -ForegroundColor Green
        Write-Host "  [i] El registro DNS https://$($cfg.domain) puede requerir" -ForegroundColor Gray
        Write-Host "      eliminacion manual en cloudflare.com" -ForegroundColor Gray
    }
}

Write-Host "  Eliminando tarea programada '$TASK_NAME'..." -ForegroundColor Gray
Stop-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "  [OK] Tarea programada eliminada" -ForegroundColor Green

Write-Host "  Limpiando archivos del sistema..." -ForegroundColor Gray
Remove-Item $CF_SYS_DIR -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $CF_INST_DIR -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "  [OK] Archivos de sistema eliminados" -ForegroundColor Green

Write-Host ""
Write-Host "  Desinstalacion completada." -ForegroundColor Green
Write-Host "  El servidor local sigue disponible via INICIAR.bat" -ForegroundColor Gray
Write-Host ""
Read-Host "  Presione ENTER para cerrar"

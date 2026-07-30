[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$CAL_DIR    = Split-Path -Parent $SCRIPT_DIR
$TASK_NAME  = "Calendario NEUROCOOP"

function OK($t)   { Write-Host "  [OK]   $t" -ForegroundColor Green }
function ERR($t)  { Write-Host "  [FALLO] $t" -ForegroundColor Red }
function INFO($t) { Write-Host "  [i]    $t" -ForegroundColor Gray }

Clear-Host
Write-Host ""
Write-Host "  ═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ESTADO DE SERVICIOS - CALENDARIO NEUROCOOP" -ForegroundColor Cyan
Write-Host "  ═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Leer config guardada
$cfgFile = "$SCRIPT_DIR\config.json"
$domain = "(no configurado)"
$tunnelName = "(no configurado)"
$port = 8765

if (Test-Path $cfgFile) {
    $cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json
    $domain     = $cfg.domain
    $tunnelName = $cfg.tunnelName
    $port       = $cfg.port
    INFO "Configuracion instalada el $($cfg.instalado)"
} else {
    Write-Host "  [!] config.json no encontrado - ejecute CONFIGURAR.bat primero" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  [ SERVIDOR NODE.JS ]" -ForegroundColor White

$taskState = (Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue).State
if ($taskState) {
    if ($taskState -eq "Running") { OK "Tarea programada '$TASK_NAME': EN EJECUCION" }
    else { ERR "Tarea programada '$TASK_NAME': $taskState" }
} else {
    ERR "Tarea programada '$TASK_NAME': NO INSTALADA"
}

$nodeResp = Invoke-WebRequest "http://localhost:$port/api/sedes" -UseBasicParsing -ErrorAction SilentlyContinue
if ($nodeResp.StatusCode -eq 200) {
    $sedesData = $nodeResp.Content | ConvertFrom-Json
    OK "API responde en puerto $port ($($sedesData.data.Count) sedes en BD)"
} else {
    ERR "API no responde en puerto $port"
}

Write-Host ""
Write-Host "  [ CLOUDFLARE TUNNEL ]" -ForegroundColor White

$cfSvc = Get-Service "Cloudflare Tunnel" -ErrorAction SilentlyContinue
if ($cfSvc) {
    if ($cfSvc.Status -eq "Running") { OK "Servicio 'Cloudflare Tunnel': EN EJECUCION" }
    else { ERR "Servicio 'Cloudflare Tunnel': $($cfSvc.Status)" }
} else {
    ERR "Servicio 'Cloudflare Tunnel': NO INSTALADO"
}

$cfSvcStartup = (Get-Service "Cloudflare Tunnel" -ErrorAction SilentlyContinue).StartType
if ($cfSvcStartup) { INFO "Tipo de inicio: $cfSvcStartup" }

Write-Host ""
Write-Host "  [ ACCESO REMOTO ]" -ForegroundColor White

if ($domain -ne "(no configurado)") {
    try {
        $remoteResp = Invoke-WebRequest "https://$domain/api/sedes" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        $remoteData = $remoteResp.Content | ConvertFrom-Json
        OK "https://$domain -> ACCESIBLE ($($remoteData.data.Count) sedes)"
    } catch {
        ERR "https://$domain -> No accesible ($($_.Exception.Message))"
        INFO "Si acaba de instalar, espere 2-3 minutos y vuelva a verificar."
    }
} else {
    INFO "Dominio no configurado. Ejecute CONFIGURAR.bat"
}

Write-Host ""
Write-Host "  ═══════════════════════════════════════════════════" -ForegroundColor Cyan

if ($domain -ne "(no configurado)") {
    Write-Host ""
    Write-Host "  URL del calendario:" -ForegroundColor Yellow
    Write-Host "    https://$domain" -ForegroundColor Green
    Write-Host "    https://$domain/gestion  (admin)" -ForegroundColor Green
}

Write-Host ""
INFO "Para reiniciar servicios manualmente:"
INFO "  Servidor: Administrador de tareas -> '$TASK_NAME'"
INFO "  Tunel:    Servicios de Windows -> 'Cloudflare Tunnel'"
Write-Host ""

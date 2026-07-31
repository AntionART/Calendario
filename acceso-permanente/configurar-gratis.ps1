#Requires -RunAsAdministrator
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = "SilentlyContinue"
$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$CAL_DIR    = Split-Path -Parent $SCRIPT_DIR
$PORT       = 8765
$TASK_NAME  = "Calendario NEUROCOOP"
$TS_EXE     = "C:\Program Files\Tailscale\tailscale.exe"
$TS_MSI     = "$env:TEMP\tailscale-setup.msi"
$TS_URL     = "https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi"

function Title($t) {
    Write-Host ""
    Write-Host "  ─────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  $t" -ForegroundColor Cyan
    Write-Host "  ─────────────────────────────────────────────────" -ForegroundColor DarkGray
}
function OK($t)   { Write-Host "  [OK] $t" -ForegroundColor Green }
function ERRX($t) { Write-Host "`n  [ERROR] $t`n" -ForegroundColor Red; Read-Host "  ENTER para salir"; exit 1 }
function INFO($t) { Write-Host "  [i] $t" -ForegroundColor White }
function WARN($t) { Write-Host "  [!] $t" -ForegroundColor Yellow }
function ASK($t)  { return (Read-Host "  $t") }

Clear-Host
Write-Host ""
Write-Host "  =============================================================" -ForegroundColor Cyan
Write-Host "  ACCESO PERMANENTE GRATUITO - TAILSCALE FUNNEL" -ForegroundColor Cyan
Write-Host "  CALENDARIO NEUROCOOP" -ForegroundColor Cyan
Write-Host "  =============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Resultado:" -ForegroundColor Yellow
Write-Host "    https://servidor-neurocoop.tailnet.ts.net" -ForegroundColor Green
Write-Host "    (URL exacta se genera durante la configuracion)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Beneficios:" -ForegroundColor White
Write-Host "    GRATIS - Sin costo, sin dominio, sin tarjeta de credito" -ForegroundColor Gray
Write-Host "    URL permanente que nunca cambia" -ForegroundColor Gray
Write-Host "    HTTPS con certificado valido automatico" -ForegroundColor Gray
Write-Host "    Sin configuracion de router ni firewall" -ForegroundColor Gray
Write-Host "    Servicios arrancan solos al encender el PC" -ForegroundColor Gray
Write-Host ""
Write-Host "  REQUISITO: Cuenta gratuita en tailscale.com" -ForegroundColor Yellow
Write-Host "    Registro: https://tailscale.com  (con Google o email)" -ForegroundColor Gray
Write-Host "    Plan Personal = GRATIS, hasta 100 dispositivos" -ForegroundColor Gray
Write-Host ""

$ready = ASK "Tiene o puede crear una cuenta gratuita en tailscale.com? [s/n]"
if ($ready -notin @("s","S","si","SI","y","Y")) {
    Write-Host ""
    Write-Host "  Crear cuenta gratis en https://tailscale.com" -ForegroundColor Yellow
    Write-Host "  Puede usar su cuenta de Google o crear con email."
    Write-Host "  Vuelva a ejecutar este script despues."
    Write-Host ""
    Read-Host "  ENTER para salir"
    exit
}

Title "PASO 1 de 4 - Instalando Tailscale"

$tsInstalled = Test-Path $TS_EXE
if ($tsInstalled) {
    $tsVer = (& $TS_EXE version 2>&1 | Select-Object -First 1)
    OK "Tailscale ya instalado: $tsVer"
} else {
    INFO "Descargando Tailscale para Windows (~60 MB)..."
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest $TS_URL -OutFile $TS_MSI -UseBasicParsing
        OK "Descarga completada"
    } catch {
        ERRX "Error de descarga: $($_.Exception.Message)`n  Verifique la conexion a internet."
    }

    INFO "Instalando Tailscale (como servicio de Windows)..."
    $msiArgs = "/i `"$TS_MSI`" /quiet /norestart ALLUSERS=1"
    $proc = Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -PassThru
    if ($proc.ExitCode -ne 0) { ERRX "Error al instalar Tailscale (codigo: $($proc.ExitCode))" }

    Start-Sleep -Seconds 5
    Remove-Item $TS_MSI -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path $TS_EXE)) { ERRX "Tailscale no se encontro despues de instalar." }
    OK "Tailscale instalado como servicio de Windows (inicio automatico)"
}

Title "PASO 2 de 4 - Autenticacion con Tailscale"
INFO "Se abrira el navegador. Inicie sesion con su cuenta de Tailscale."
INFO "Si ya esta autenticado, el proceso sera inmediato."
Write-Host ""
Read-Host "  Presione ENTER para abrir el navegador"

& $TS_EXE login 2>&1 | Write-Host

INFO "Esperando que complete el login..."
$authOk = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 3
    $status = (& $TS_EXE status 2>&1) -join " "
    if ($status -match "logged in" -or $status -match "Tailscale is up") {
        $authOk = $true; break
    }
    if ($status -notmatch "log in" -and $status -match "\." ) {
        $authOk = $true; break
    }
}

if (-not $authOk) {
    WARN "No se pudo confirmar el login automaticamente."
    $manual = ASK "Completo el login en el navegador? [s/n]"
    if ($manual -notin @("s","S","si","SI","y","Y")) {
        ERRX "Login no completado. Vuelva a ejecutar el script."
    }
}
OK "Autenticacion con Tailscale completada"

Title "PASO 3 de 4 - Activando Funnel (acceso publico)"

INFO "Habilitando Tailscale Funnel en puerto $PORT..."
INFO "Esto hace el calendario accesible desde cualquier lugar sin VPN."
Write-Host ""

$funnelOut = (& $TS_EXE funnel --bg $PORT 2>&1) -join "`n"
Write-Host $funnelOut

if ($LASTEXITCODE -ne 0) {
    WARN "Error al activar Funnel: $funnelOut"
    WARN "Intentando con serve..."
    $serveOut = (& $TS_EXE serve --bg $PORT 2>&1) -join "`n"
    Write-Host $serveOut
}

Start-Sleep -Seconds 3
$tsStatusRaw = (& $TS_EXE status 2>&1) -join "`n"
$dnsName = [regex]::Match($tsStatusRaw, 'DNS name:\s+(\S+)').Groups[1].Value
if (-not $dnsName) {
    $dnsName = [regex]::Match($tsStatusRaw, '([\w\-]+\.[\w\-]+\.ts\.net)').Groups[1].Value
}

$tsUrl = ""
if ($dnsName) {
    $tsUrl = "https://$dnsName"
    OK "URL generada: $tsUrl"
} else {
    WARN "No se pudo obtener la URL automaticamente."
    INFO "Ejecute: tailscale funnel status"
    INFO "O revise el panel en https://login.tailscale.com/admin/machines"
}

Title "PASO 4 de 4 - Configurando servidor Node.js"
INFO "Registrando Node.js para inicio automatico con Windows..."

$nodeBin = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeBin) { $nodeBin = "node.exe" }

Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction `
    -Execute $nodeBin `
    -Argument "server.js" `
    -WorkingDirectory $CAL_DIR

$trigger = New-ScheduledTaskTrigger -AtStartup

$settings = New-ScheduledTaskSettingsSet `
    -RestartCount 10 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable $true `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TASK_NAME `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

OK "Tarea programada registrada: inicio automatico con Windows"

Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName $TASK_NAME
Start-Sleep -Seconds 5

$nodeOk = $false
for ($i = 1; $i -le 6; $i++) {
    $r = Invoke-WebRequest "http://localhost:$PORT/api/sedes" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) { $nodeOk = $true; break }
    Start-Sleep -Seconds 2
}

@{
    metodo    = "tailscale-funnel"
    url       = $tsUrl
    port      = $PORT
    instalado = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json | Set-Content "$SCRIPT_DIR\config-gratis.json" -Encoding utf8

Clear-Host
Write-Host ""
Write-Host "  =============================================================" -ForegroundColor Green
Write-Host "  CONFIGURACION COMPLETADA - ACCESO GRATUITO" -ForegroundColor Green
Write-Host "  =============================================================" -ForegroundColor Green
Write-Host ""

if ($nodeOk) { Write-Host "  [OK] Servidor Node.js activo en puerto $PORT" -ForegroundColor Green }
else         { Write-Host "  [!] Servidor Node.js: iniciando..." -ForegroundColor Yellow }

$cfSvc = Get-Service "Tailscale" -ErrorAction SilentlyContinue
if ($cfSvc -and $cfSvc.Status -eq "Running") {
    Write-Host "  [OK] Tailscale: activo como servicio de Windows" -ForegroundColor Green
}

Write-Host ""
Write-Host "  URL PERMANENTE Y GRATUITA:" -ForegroundColor Yellow
Write-Host ""

if ($tsUrl) {
    Write-Host "    Portal: $tsUrl" -ForegroundColor Green
    Write-Host "    Admin:  $tsUrl/gestion" -ForegroundColor Green
} else {
    Write-Host "    Ejecute: tailscale funnel status" -ForegroundColor Cyan
    Write-Host "    O revise: https://login.tailscale.com/admin/machines" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  AUTOMATICO: Los servicios arrancan solos al encender el PC." -ForegroundColor White
Write-Host "  Costo total: GRATIS para siempre (plan Personal de Tailscale)." -ForegroundColor White
Write-Host ""
Write-Host "  Servicios activos:" -ForegroundColor Gray
Write-Host "    Servicio Windows: Tailscale (tunel internet)" -ForegroundColor Gray
Write-Host "    Tarea Programada: $TASK_NAME (servidor web)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Panel de control: https://login.tailscale.com/admin/machines" -ForegroundColor Gray
Write-Host ""
Read-Host "  Presione ENTER para cerrar"

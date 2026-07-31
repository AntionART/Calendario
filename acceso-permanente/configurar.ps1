#Requires -RunAsAdministrator
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = "SilentlyContinue"
$ErrorActionPreference = "Stop"

$SCRIPT_DIR  = Split-Path -Parent $MyInvocation.MyCommand.Path
$CAL_DIR     = Split-Path -Parent $SCRIPT_DIR
$CF_EXE      = "$CAL_DIR\cloudflared.exe"
$CF_INST_DIR = "C:\Program Files\Cloudflared"
$CF_SYS_DIR  = "C:\Windows\System32\config\systemprofile\.cloudflared"
$CF_USR_DIR  = "$env:USERPROFILE\.cloudflared"
$PORT        = 8765
$TASK_NAME   = "Calendario NEUROCOOP"

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
Write-Host "  ACCESO PERMANENTE CON URL FIJA - CALENDARIO NEUROCOOP" -ForegroundColor Cyan
Write-Host "  Powered by Cloudflare Tunnel (gratuito)" -ForegroundColor Cyan
Write-Host "  =============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Resultado:" -ForegroundColor Yellow
Write-Host "    https://calendario.sudominio.com           Portal publico" -ForegroundColor Green
Write-Host "    https://calendario.sudominio.com/gestion   Admin" -ForegroundColor Green
Write-Host ""
Write-Host "  Beneficios:" -ForegroundColor White
Write-Host "    URL que nunca cambia - HTTPS automatico - Sin advertencias" -ForegroundColor Gray
Write-Host "    Servicios arrancan solos al encender el PC" -ForegroundColor Gray
Write-Host "    Sin configuracion de router ni firewall" -ForegroundColor Gray
Write-Host ""
Write-Host "  REQUISITO UNICO: Cuenta Cloudflare + dominio en Cloudflare" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Opciones de dominio (~8-10 USD/ano):" -ForegroundColor White
Write-Host "    cloudflare.com/products/registrar   porkbun.com   namecheap.com" -ForegroundColor Gray
Write-Host ""

$ready = ASK "Tiene cuenta en cloudflare.com y un dominio agregado? [s/n]"
if ($ready -notin @("s","S","si","SI","y","Y","yes")) {
    Write-Host ""
    Write-Host "  Pasos para prepararse:" -ForegroundColor Yellow
    Write-Host "  1. Crear cuenta gratis en https://cloudflare.com"
    Write-Host "  2. En el panel -> Add a Site -> ingresar su dominio"
    Write-Host "  3. Cloudflare le dara 2 nameservers para configurar en su registrador"
    Write-Host "  4. Esperar 5-30 minutos y volver a ejecutar este script"
    Write-Host ""
    Read-Host "  ENTER para salir"
    exit
}

if (-not (Test-Path $CF_EXE)) {
    ERRX "cloudflared.exe no encontrado en: $CF_EXE"
}
New-Item -Path $CF_INST_DIR -ItemType Directory -Force | Out-Null
Copy-Item $CF_EXE "$CF_INST_DIR\cloudflared.exe" -Force
$CF_BIN = "$CF_INST_DIR\cloudflared.exe"
OK "cloudflared copiado a $CF_INST_DIR"

Title "PASO 1 de 5 - Autenticacion con Cloudflare"
INFO "Se abrira el navegador. Inicie sesion y seleccione su dominio."
Write-Host ""
Read-Host "  Presione ENTER para abrir el navegador"

& $CF_BIN tunnel login 2>&1 | Write-Host
if ($LASTEXITCODE -ne 0) { ERRX "Fallo la autenticacion. Complete el proceso en el navegador." }
OK "Autenticacion completada"

Title "PASO 2 de 5 - Creando tunel permanente"
$tunnelName = ASK "Nombre del tunel (solo letras y guiones, ej: calendario-neurocoop)"
if (-not $tunnelName) { $tunnelName = "calendario-neurocoop" }
$tunnelName = $tunnelName.ToLower() -replace '[^a-z0-9\-]', '-'

$listRaw = (& $CF_BIN tunnel list 2>&1) -join "`n"
$existLine = ($listRaw -split "`n") | Where-Object { $_ -match "\b$([regex]::Escape($tunnelName))\b" } | Select-Object -First 1

if ($existLine) {
    WARN "Tunel '$tunnelName' ya existe. Reutilizando."
} else {
    $createRaw = (& $CF_BIN tunnel create $tunnelName 2>&1) -join "`n"
    Write-Host $createRaw
    if ($LASTEXITCODE -ne 0) { ERRX "No se pudo crear el tunel. Verifique la autenticacion." }
    $listRaw    = (& $CF_BIN tunnel list 2>&1) -join "`n"
    $existLine  = ($listRaw -split "`n") | Where-Object { $_ -match "\b$([regex]::Escape($tunnelName))\b" } | Select-Object -First 1
}

$tunnelId = [regex]::Match($existLine, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}').Value
if (-not $tunnelId) {
    Write-Host ""
    Write-Host "  Tunneles encontrados:" -ForegroundColor Yellow
    Write-Host $listRaw
    $tunnelId = ASK "Ingrese el UUID del tunel manualmente"
}
if (-not $tunnelId) { ERRX "UUID del tunel no disponible." }
OK "Tunel: $tunnelName  (ID: $tunnelId)"

Title "PASO 3 de 5 - Asignando dominio permanente"
INFO "Ejemplo: si su dominio es neurocoop.com escriba calendario.neurocoop.com"
Write-Host ""
$domain = ASK "Dominio completo (ej: calendario.neurocoop.com)"
if (-not $domain) { ERRX "Debe ingresar un dominio valido." }
$domain = $domain.Trim().ToLower()

$dnsRaw = (& $CF_BIN tunnel route dns $tunnelName $domain 2>&1) -join "`n"
Write-Host $dnsRaw
if ($LASTEXITCODE -ne 0) {
    WARN "El registro DNS puede ya existir. Continuando..."
}
OK "DNS configurado: https://$domain -> tunel $tunnelName"

Title "PASO 4 de 5 - Generando configuracion del servicio"

$credSrc = "$CF_USR_DIR\$tunnelId.json"
if (-not (Test-Path $credSrc)) {
    $credSrc = Get-ChildItem $CF_USR_DIR -Filter "*.json" -ErrorAction SilentlyContinue |
               Select-Object -First 1 -ExpandProperty FullName
}
if (-not $credSrc -or -not (Test-Path $credSrc)) {
    ERRX "Archivo de credenciales no encontrado en $CF_USR_DIR"
}
OK "Credenciales: $credSrc"

New-Item -Path $CF_SYS_DIR -ItemType Directory -Force | Out-Null

$cfgLines = @(
    "tunnel: $tunnelId",
    "credentials-file: $CF_SYS_DIR\$tunnelId.json",
    "",
    "ingress:",
    "  - hostname: $domain",
    "    service: http://localhost:$PORT",
    "    originRequest:",
    "      connectTimeout: 30s",
    "      tcpKeepAlive: 30s",
    "      keepAliveConnections: 100",
    "  - service: http_status:404"
)
$cfgLines | Set-Content "$CF_SYS_DIR\config.yml" -Encoding utf8

Copy-Item $credSrc "$CF_SYS_DIR\$tunnelId.json" -Force
if (Test-Path "$CF_USR_DIR\cert.pem") {
    Copy-Item "$CF_USR_DIR\cert.pem" "$CF_SYS_DIR\cert.pem" -Force
}
OK "config.yml creado en $CF_SYS_DIR"
OK "Credenciales copiadas al perfil del sistema"

@{
    tunnelName = $tunnelName
    tunnelId   = $tunnelId
    domain     = $domain
    port       = $PORT
    instalado  = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json | Set-Content "$SCRIPT_DIR\config.json" -Encoding utf8
OK "Configuracion guardada en config.json"

Title "PASO 5 de 5 - Instalando servicios de Windows"

INFO "Instalando Cloudflare Tunnel como servicio de Windows..."

$existingSvc = Get-Service "Cloudflare Tunnel" -ErrorAction SilentlyContinue
if ($existingSvc) {
    Stop-Service "Cloudflare Tunnel" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    & $CF_BIN service uninstall 2>$null
    Start-Sleep -Seconds 2
}
$svcOut = (& $CF_BIN service install 2>&1) -join "`n"
Write-Host $svcOut

$cfSvcOk = (Get-Service "Cloudflare Tunnel" -ErrorAction SilentlyContinue) -ne $null
if (-not $cfSvcOk) { ERRX "No se pudo instalar el servicio Cloudflare Tunnel." }
Set-Service "Cloudflare Tunnel" -StartupType Automatic
OK "Servicio Cloudflare Tunnel instalado (inicio automatico)"

INFO "Registrando servidor Node.js como tarea programada..."

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

Title "Iniciando servicios"

Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

INFO "Iniciando servidor Node.js..."
Start-ScheduledTask -TaskName $TASK_NAME
Start-Sleep -Seconds 5

INFO "Iniciando Cloudflare Tunnel..."
Start-Service "Cloudflare Tunnel" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 6

$nodeOk = $false
for ($i = 1; $i -le 6; $i++) {
    $r = Invoke-WebRequest "http://localhost:$PORT/api/sedes" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 200) { $nodeOk = $true; break }
    Start-Sleep -Seconds 2
}
$cfOk = (Get-Service "Cloudflare Tunnel" -ErrorAction SilentlyContinue).Status -eq "Running"

Clear-Host
Write-Host ""
Write-Host "  =============================================================" -ForegroundColor Green
Write-Host "  CONFIGURACION COMPLETADA" -ForegroundColor Green
Write-Host "  =============================================================" -ForegroundColor Green
Write-Host ""

if ($nodeOk) { OK "Servidor Node.js activo en puerto $PORT" }
else          { WARN "Servidor Node.js: iniciando (espere 1 minuto)" }

if ($cfOk)   { OK "Cloudflare Tunnel activo y conectado" }
else         { WARN "Cloudflare Tunnel: iniciando (espere 1-2 minutos)" }

Write-Host ""
Write-Host "  URL PERMANENTE (disponible en ~2 minutos):" -ForegroundColor Yellow
Write-Host ""
Write-Host "    Portal: https://$domain" -ForegroundColor Green
Write-Host "    Admin:  https://$domain/gestion" -ForegroundColor Green
Write-Host ""
Write-Host "  AUTOMATICO: Ambos servicios arrancan solos al encender el PC." -ForegroundColor White
Write-Host "  Comparta la URL con las sedes. No necesita hacer nada mas." -ForegroundColor White
Write-Host ""
Write-Host "  Para verificar: ejecute VERIFICAR.bat" -ForegroundColor Gray
Write-Host "  Panel Cloudflare: cloudflare.com -> Zero Trust -> Tunnels" -ForegroundColor Gray
$svcMsg = "  Tunel " + $tunnelName + " debe aparecer como HEALTHY"
Write-Host $svcMsg -ForegroundColor Gray
Write-Host ""
Read-Host "  Presione ENTER para cerrar"

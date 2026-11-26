# Calendario NEUROCOOP

> **Sistema Corporativo de Gestión de Agendas Médicas y Control de Sedes**  
> Diseñado y desarrollado para alta disponibilidad, resiliencia operativa y sincronización multi-sede.

[![Node.js](https://img.shields.io/badge/Node.js-24.x-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite_WAL-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Electron](https://img.shields.io/badge/Desktop-Electron_NSIS-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Security](https://img.shields.io/badge/Security-Ed25519_Signed-10B981?style=flat-square)](https://github.com/AntionART/Calendario)
[![Architecture](https://img.shields.io/badge/Deployment-PM2_%2F_Ngrok-orange?style=flat-square)](https://github.com/AntionART/Calendario)

---

## 1. Descripción General

**Calendario NEUROCOOP** es una plataforma integral de agendamiento y visualización cronológica diseñada para centralizar la disponibilidad de especialistas, citas, procedimientos y eventos clínicos en las sedes físicas de la institución:
- **Cúcuta**
- **Pamplona**
- **Ocaña**

El sistema provee interfaces diferenciadas:
1. **Portal Público de Consulta (`/`)**: Visualización rápida mensual, semanal y diaria de eventos por sede, con filtrado dinámico, visualización de adjuntos y diseño optimizado para equipos de atención al usuario y recepción.
2. **Panel de Gestión Clínica (`/gestion`)**: Control administrativo para creación, edición, reprogramación y auditoría de agendas médicas, subida de anexos y parametrización institucional.
3. **Módulo de Supervisión de Escritorio (`Electron`)**: Aplicación con panel visual de control que gestiona el ciclo de vida del servidor Express, supervisión de salud del proceso, túnel seguro Ngrok y copias de seguridad inmediatas.

---

## 2. Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────┐
│                   Cliente / Navegadores                │
│       (Red Local, VPN Institucional o Túnel Ngrok)      │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / HTTPS
┌───────────────────────────▼────────────────────────────┐
│                    Express HTTP Server                 │
│  - /api (Consulta pública con filtrado por sede)       │
│  - /api/admin (Gestión con autenticación segura)       │
│  - /api/control (API IPC para control del supervisor)  │
│  - Licenciamiento Ed25519 (Validación por hardware)    │
└──────────────┬───────────────────────────┬─────────────┘
              │                           │
┌──────────────▼─────────────┐ ┌───────────▼─────────────┐
│    SQLite 3 (WAL Mode)     │ │   Almacenamiento Local  │
│  - eventos (agendas)       │ │   /uploads (adjuntos)   │
│  - sedes, tipos_evento     │ └─────────────────────────┘
│  - usuarios, configuracion │
└────────────────────────────┘
```

- **Motor SQLite en Modo WAL**: Soporta transacciones concurrentes de lectura y escritura ultrarrápidas, garantizando lecturas sin bloqueo y persistencia ante caídas de energía.
- **Seguridad Criptográfica Ed25519**: Validación estricta de licencias de software vinculadas al identificador criptográfico de hardware (`MachineGuid`) del servidor anfitrión.
- **Respaldos Automatizados a GitHub**: Módulo en segundo plano (`respaldoGithub.js`) que genera respaldos en caliente (`VACUUM INTO`), verifica integridad con hash SHA-256 y sincroniza copias estructuradas a un repositorio privado.
- **Túnel Seguro de Acceso Remoto**: Integración con Ngrok para permitir el acceso unificado desde sedes remotas sin requerir apertura de puertos WAN inseguros.

---

## 3. Estructura del Proyecto

```
Calendario/
├── build/                 # Herramientas de empaquetado, ofuscación y staging
├── electron/              # Supervisor de escritorio (Main process, Tray, Managers)
├── electron-admin-ui/     # Interfaz gráfica local del supervisor de escritorio
├── public/                # Frontend web (HTML5, CSS3, JavaScript modular)
│   ├── admin/             # Portal de administración (/gestion)
│   └── css / js           # Estilos corporativos y lógica de interfaz
├── routes/                # Enrutadores Express (API pública, admin y control)
├── shared/                # Utilidades comunes (Almacén de configuración, IPC)
├── database.js            # Conexión, inicialización y esquema SQLite
├── license.js             # Verificación criptográfica de licencia Ed25519
├── respaldoGithub.js      # Motor de respaldo continuo a repositorio remoto
├── server.js              # Punto de entrada del servidor Express
└── package.json           # Manifiesto de dependencias y scripts de compilación
```

---

## 4. Requisitos del Entorno

- **Runtime**: Node.js `>= 20.x` (Recomendado Node.js 24.x LTS).
- **Sistema Operativo**: Windows 10 / Windows 11 / Windows Server 2016+.
- **Herramientas**: Git para Windows configurado con credenciales de acceso.
- **Ngrok**: Binario de Ngrok configurado para túnel WAN corporativo.

---

## 5. Configuración de Túnel WAN (Ngrok) y Dominio Fijo

El sistema utiliza **Ngrok** para ofrecer acceso exterior a las sedes de Pamplona y Ocaña mediante un dominio fijo seguro (HTTPS).

### 5.1 Ubicación y Configuración en el Servidor
- **Binario**: `C:\ngrok\ngrok.exe`
- **Archivo de Configuración**: `%LOCALAPPDATA%\ngrok\ngrok.yml` (`C:\Users\AuxSistemas\AppData\Local\ngrok\ngrok.yml`)

### 5.2 Estructura del Archivo `ngrok.yml`
```yaml
version: "3"
agent:
    authtoken: 3BV28FWJ66E9lsT4jX8Yvg7jCtW_6waSNTq8vkbaLprRWQggt

tunnels:
  calendario:
    proto: http
    addr: 127.0.0.1:8765
    domain: unsoldierlike-izayah-tetchily.ngrok-free.dev
```

### 5.3 Comandos de Gestión de Ngrok
```bash
# Verificar validez de la configuración
ngrok config check

# Iniciar túnel de forma manual
ngrok start calendario

# Operar túnel en segundo plano permanente con PM2
pm2 start "C:\ngrok\ngrok.exe" --name "calendario-tunnel" -- start calendario
pm2 save
```

### 5.4 Enlaces de Producción
- **Acceso Público para Sedes**: `https://unsoldierlike-izayah-tetchily.ngrok-free.dev`
- **Gestión Administrativa**: `https://unsoldierlike-izayah-tetchily.ngrok-free.dev/gestion`

---

## 6. Procedimiento de Restauración en Servidor Nuevo o por Falla

En caso de reinstalación, cambio de servidor o desastre técnico, el procedimiento exacto es:

### Paso 1: Clonar el Repositorio e Instalar Dependencias
```bash
git clone https://github.com/AntionART/Calendario.git
cd Calendario
npm install
```

### Paso 2: Configurar Ngrok
1. Descargar `ngrok.exe` y ubicarlo en `C:\ngrok\ngrok.exe`.
2. Agregar al PATH o crear la configuración en `%LOCALAPPDATA%\ngrok\ngrok.yml` con el authtoken y el túnel `calendario` (ver sección 5.2).

### Paso 3: Licenciamiento
Colocar el archivo `license.lic` firmado en la raíz del proyecto. El sistema validará automáticamente la firma criptográfica con la clave pública Ed25519 embebida.

### Paso 4: Restaurar Base de Datos
Copiar el último respaldo de `calendario.db` en la carpeta `db/` y los adjuntos en `uploads/`.

### Paso 5: Compilar el Instalador Desktop o Iniciar con PM2
- **Opción A (Instalador Desktop Autónomo)**:
  ```bash
  npm run build:desktop
  ```
  Ejecutar el instalador generado en `release/CalendarioNeurocoop-Setup-1.0.0.exe`.

- **Opción B (Servicio de fondo con PM2)**:
  ```bash
  pm2 start server.js --name "calendario" -- --port 8765
  pm2 start "C:\ngrok\ngrok.exe" --name "calendario-tunnel" -- start calendario
  pm2 save
  ```

---

## 7. Compilación del Instalador Autónomo (Desktop NSIS)

El proyecto cuenta con un proceso de construcción automatizado que ofusca el código fuente y empaqueta un runtime de Node.js portátil:

```bash
npm run build:desktop
```

Etapas de construcción:
1. `icon`: Genera el ícono oficial `icon.ico` a partir del activo institucional.
2. `vendor:node`: Prepara el binario `node.exe` autocontenido.
3. `obfuscate`: Aplica ofuscación JavaScript avanzada a las capas de negocio y frontend.
4. `stage`: Consolida los recursos de producción y dependencias estrictas.
5. `verify:staged`: Levanta un servidor efímero para validar endpoints y licencias antes de empaquetar.
6. `electron-builder`: Compila el instalador final en `release/CalendarioNeurocoop-Setup-<version>.exe`.

---

## 8. Seguridad y Control de Acceso

- **Protección de Sesiones**: Tokens de sesión firmados con secretos de 256 bits generados criptográficamente.
- **Límite de Intentos (Rate Limiting)**: Mitigación de fuerza bruta en `/api/admin/login` con bloqueo temporal por IP tras 5 intentos fallidos.
- **Modo Sandbox**: Servidor configurado con cabeceras de seguridad `helmet` y validación de tipos MIME en carga de adjuntos.
- **Licencia Inviolable**: Las instancias requieren un archivo `license.lic` firmado digitalmente con clave privada Ed25519; si se altera o se ejecuta en un servidor no autorizado, el sistema bloquea el acceso de forma segura sin comprometer los datos almacenados.

---

## 9. Autoría y Créditos

- **Desarrollador Principal**: [Daniel Arteaga](https://github.com/AntionART) (`DanielARTp`)
- **Organización**: NEUROCOOP  
- **Año**: 2026

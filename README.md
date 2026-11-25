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
3. **Módulo de Supervisión de Escritorio (`Electron`)**: Aplicación de bandeja de sistema (*system tray*) que gestiona el ciclo de vida del servidor Express, supervisión de salud del proceso, túnel seguro y copias de seguridad.

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
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
┌─────────────▼─────────────┐ ┌───────────▼──────────────┐
│  Better-SQLite3 (WAL DB)  │ │   Respaldo Automatizado  │
│  - Transacciones atómicas │ │  - VACUUM INTO diario    │
│  - Cero bloqueos lectura  │ │  - Sincronización GitHub │
│  - Índices optimizados    │ │  - Manifiesto SHA-256    │
└───────────────────────────┘ └──────────────────────────┘
```

### Componentes Clave

- **Motor de Base de Datos**: SQLite 3 mediante `better-sqlite3`, configurado en modo `WAL` (*Write-Ahead Logging*) y claves foráneas activas, garantizando lecturas concurrentes sin bloqueo y persistencia ante caídas de energía.
- **Seguridad Criptográfica Ed25519**: Validación estricta de licencias de software vinculadas al identificador criptográfico de hardware (`MachineGuid`) del servidor anfitrión.
- **Respaldos Automatizados a GitHub**: Módulo en segundo plano (`respaldoGithub.js`) que genera respaldos diarios en caliente (`VACUUM INTO`), verifica integridad con hash SHA-256 y sincroniza copias estructuradas por año/mes/semana a un repositorio privado.
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
- **Módulo Nativo**: Compilador compatible para `better-sqlite3` si se reconstruyen dependencias.

---

## 5. Instalación y Puesta en Marcha

### 5.1 Modo Desarrollo
```bash
# Instalar dependencias
npm install

# Iniciar servidor en modo desarrollo
npm start

# Iniciar supervisor de escritorio Electron
npm run electron:dev
```

### 5.2 Compilación del Instalador Autónomo (Desktop NSIS)
El proyecto cuenta con un proceso de construcción automatizado que ofusca el código fuente y empaqueta un runtime de Node.js portátil:

```bash
npm run build:desktop
```

Este comando ejecuta las siguientes etapas:
1. `icon`: Genera el ícono oficial `icon.ico` a partir del activo institucional.
2. `vendor:node`: Prepara el binario `node.exe` autocontenido.
3. `obfuscate`: Aplica ofuscación a las capas de negocio y frontend.
4. `stage`: Consolida los recursos de producción y dependencias estrictas.
5. `verify:staged`: Levanta un servidor efímero para validar endpoints antes de empaquetar.
6. `electron-builder`: Compila el instalador final en `release/CalendarioNeurocoop-Setup-<version>.exe`.

---

## 6. Operación en Producción y Alta Disponibilidad

Para despliegues en servidores donde el software deba iniciar automáticamente tras reinicios o cortes de energía, se recomienda operar mediante **PM2**:

```bash
# Iniciar servidor Express
pm2 start server.js --name "calendario" -- --port 8765

# Iniciar túnel Ngrok (opcional)
pm2 start "ngrok http 8765" --name "calendario-tunnel"

# Persistir configuración para arranque automático con el sistema
pm2 save
```

---

## 7. Seguridad y Control de Acceso

- **Protección de Sesiones**: Tokens de sesión firmados con secretos de 256 bits generados criptográficamente.
- **Límite de Intentos (Rate Limiting)**: Mitigación de fuerza bruta en `/api/admin/login` con bloqueo temporal por IP tras 5 intentos fallidos.
- **Modo Sandbox**: Servidor configurado con cabeceras de seguridad `helmet` y validación de tipos MIME en carga de adjuntos.
- **Licencia Inviolable**: Las instancias requieren un archivo `license.lic` firmado digitalmente con clave privada Ed25519; si se altera o se ejecuta en un servidor no autorizado, el sistema bloquea el acceso de forma segura sin comprometer los datos almacenados.

---

## 8. Autoría y Créditos

- **Desarrollador Principal**: [Daniel Arteaga](https://github.com/AntionART) (`DanielARTp`)
- **Organización**: NEUROCOOP  
- **Año**: 2026

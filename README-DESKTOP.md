# Calendario NEUROCOOP — App de escritorio

Empaquetado del Calendario NEUROCOOP como aplicación de escritorio independiente para Windows (ícono de bandeja + panel de administración), sin depender de tener Node.js instalado en la máquina destino.

## Arquitectura (resumen)

- El servidor Express original (`server.js`, `database.js`, `routes/`) no cambia en su funcionamiento: sigue sirviendo el calendario público y el panel `/gestion` igual que siempre.
- Una app **Electron** (`electron/`) actúa como supervisor: muestra un ícono de bandeja y una ventana de panel de administración, y lanza el servidor Express como **proceso hijo** usando un Node.js portátil embebido (necesario porque `better-sqlite3` es un módulo nativo compilado para una versión específica de Node — no puede correr dentro del proceso de Electron sin recompilarlo).
- El panel de administración de escritorio (`electron-admin-ui/`) es distinto del panel web `/gestion`: el panel de escritorio controla el *proceso* (iniciar/detener/backups), el panel web administra el *contenido* del calendario (eventos, sedes, etc.).

## Requisitos para compilar

- Node.js 24.x instalado en la máquina de build (el mismo usado para compilar `better-sqlite3`, ya presente en este equipo).
- Haber corrido `npm install` en la raíz del proyecto (instala tanto las dependencias de producción como las de build: Electron, electron-builder, javascript-obfuscator, etc.).

## Compilar el instalador

Un solo comando:

```
npm run build:desktop
```

Esto ejecuta en orden:
1. `icon` — genera `build/icon.ico` a partir de `public/Favicon.png`.
2. `vendor:node` — copia el `node.exe` local a `vendor/node-runtime/` (el runtime portátil que ejecutará el servidor).
3. `obfuscate` — ofusca `server.js`, `database.js`, `routes/*.js`, `shared/*.js`, `scripts/*.js` y `public/js/*.js` hacia `dist-app/app-server/` (el código fuente original nunca se copia al paquete final).
4. `stage` — copia el resto de `public/` (HTML/CSS/imágenes) y solo las dependencias de **producción** de `node_modules` (usando `npm ls --omit=dev`) hacia `dist-app/app-server/`. **No** copia `db/` ni `uploads/` — esos se preservan/instalan por separado.
5. `verify:staged` — levanta el servidor ya ofuscado en un puerto de prueba y valida que `/api/sedes` y `/gestion` respondan correctamente. Si esto falla, el build se detiene antes de generar el instalador.
6. `electron-builder --win` — genera el instalador NSIS en `release/CalendarioNeurocoop-Setup-<version>.exe`.

El código fuente original (sin ofuscar) nunca queda dentro del instalador ni del paquete instalado — solo `dist-app/app-server/` (ofuscado) es lo que se empaqueta.

## Instalar

Ejecutar el `.exe` generado en `release/`. Es un instalador **por usuario** (no requiere permisos de administrador), se instala por defecto en `%LocalAppData%\Programs\CalendarioNeurocoop`.

- En una instalación **nueva**, la app crea `db/` y `uploads/` vacíos al primer arranque.
- En una **reinstalación/actualización** sobre una carpeta que ya tiene `db/` o `uploads/`, esos archivos se preservan (nunca se sobrescriben ni se borran).
- Al desinstalar, se pregunta explícitamente si se desean borrar también los datos del calendario; por defecto se conservan.

## Usar el panel de administración

Al iniciar, la app se minimiza al ícono de bandeja junto al reloj de Windows. Clic en el ícono (o "Mostrar panel" desde el menú de bandeja) abre la ventana del panel, con estas secciones:

- **Estado**: iniciar / detener / reiniciar el servidor, ver si está encendido y su tiempo activo, abrir el calendario en el navegador, y activar/detener el túnel de acceso remoto (ngrok) si está instalado en `C:\ngrok\ngrok.exe`.
- **Logs**: últimas líneas del servidor, con botón de actualizar.
- **Copias de seguridad**: carpeta de destino configurable, crear copia manual (usa `VACUUM INTO` de SQLite — seguro incluso con el servidor corriendo en modo WAL), listar copias existentes y restaurar cualquiera de ellas (detiene el servidor, reemplaza la base de datos, y lo vuelve a iniciar).
- **Configuración**: puerto del servidor, inicio automático con Windows, y programación de copias de seguridad automáticas con retención configurable.

La contraseña de administrador del panel web `/gestion` sigue siendo la configurada en el sistema (por defecto la que ya usa el equipo de sistemas hoy) — el panel de escritorio nunca la solicita ni la muestra; los backups usan un token interno separado, no la contraseña de admin.

## Copia en GitHub

Igual que NeuroTurn, el servidor sube cada noche (desde la 1:00 a. m., cada 10 minutos hasta lograrlo; si falla reintenta pasada una hora) una copia del día a un repositorio **privado** de GitHub (`respaldoGithub.js`):

```
2026/10-octubre/semana-44/2026-10-29-jueves/
  base-datos/calendario.db   base completa (VACUUM INTO)
  MANIFIESTO.json            tamaño, SHA-256 y filas por tabla
  LEEME.txt                  cómo restaurar
  RESUMEN.txt
archivos/                    uploads/ y Logos.png tal como estaban ese día
```

Un commit `Respaldo AAAA-MM-DD` por día; la configuración (`config.json`, secretos) no se sube. En `/gestion` → Configuración → **Copia en GitHub** se ve el estado, se fuerza la subida ("Subir ahora") y se descarga cualquier día en ZIP (solo desde la red interna).

Preparación (una sola vez): crear el repositorio privado en GitHub y clonarlo en `%LOCALAPPDATA%\CalendarioNeurocoop\respaldo-github` (fuera de la carpeta de instalación, para que sobreviva a reinstalaciones). Git usa las credenciales guardadas en Windows.

- Solo corre cuando el servidor lo lanza la app de escritorio; con `node server.js` en desarrollo está apagada salvo `RESPALDO_GITHUB=on`.
- `RESPALDO_GITHUB=off` la apaga; `RESPALDO_GITHUB_REPO_LOCAL` usa un clon en otra carpeta.

## Desarrollo (sin empaquetar)

```
npm run electron:dev
```

Levanta la app Electron directamente contra el código fuente sin ofuscar (usa el `node` del sistema, no el runtime portátil), útil para probar cambios en el panel o en los managers de Electron sin recompilar el instalador completo.

## Notas para quien mantenga esto

- Si se actualiza Node.js o `better-sqlite3` en la máquina de build, hay que volver a correr `npm run vendor:node` (o directamente `npm run build:desktop`) para que el runtime portátil siga coincidiendo en ABI con el binario nativo — si no coinciden, el servidor empaquetado no arrancará.
- `node_modules/` está versionado en este repositorio (práctica existente del proyecto). Al agregar las dependencias de build (Electron, electron-builder, etc.) como `devDependencies`, `node_modules` crece considerablemente (~250MB+); si se comitea, revisar que no se esté subiendo por accidente contenido que no corresponda.
- Las carpetas `vendor/`, `dist-app/`, `release/` y `build/icon.ico` son generadas por el build y están en `.gitignore` — no se versionan.

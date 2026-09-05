# reservas-wpp

Servicio Node.js independiente para enviar recordatorios de reservas de misa por WhatsApp. Laravel/cPanel continúa siendo la fuente principal de verdad y el servicio Node.js consumirá una API privada autenticada; no se conecta directamente a la base de datos de Laravel.

## Estado del proyecto

| Componente | Estado |
| --- | --- |
| Node Service | READY |
| Laravel Integration | PENDING |
| Oracle Base Server | READY |
| Chromium ARM64 | VALIDATED |
| WhatsApp Institutional Session | PENDING |
| Production Automatic Reminders | DISABLED by default |

La sesión WhatsApp y la integración Laravel aún no se han conectado en este entorno.

## Capacidades implementadas

Esta entrega completa las fases Node.js previstas:

- estructura inicial;
- configuración mediante variables de entorno;
- logger `pino` con redacción de secretos;
- enmascarado de teléfonos;
- pruebas base;
- integración de `whatsapp-web.js`;
- persistencia de sesión mediante `LocalAuth`;
- visualización de QR y eventos de conexión;
- prueba manual explícita y protegida;
- cliente Laravel con token Bearer;
- timeout, validación JSON y reintentos con backoff;
- reportes de estados `sent` y `failed`;
- normalización de teléfonos ecuatorianos;
- formateo de mensajes y fechas;
- scheduler cada cinco minutos;
- lock local contra solapamientos;
- procesamiento defensivo e idempotencia local;
- configuración PM2 para una instancia.

La integración final requiere que Laravel implemente el contrato descrito abajo. Node.js contiene el scheduler y el procesamiento automático, pero `REMINDER_JOB_ENABLED=false` lo mantiene desactivado por defecto hasta validar el contrato y vincular el número institucional.

## Arquitectura prevista

```text
Laravel / cPanel
        | API privada HTTPS + token
Servicio Node.js / Oracle Cloud ARM64
        | whatsapp-web.js + LocalAuth
WhatsApp institucional vinculado mediante QR
```

Laravel decidirá qué recordatorios están vencidos/elegibles. Node.js procesará únicamente la lista recibida y reportará los resultados a endpoints internos. La idempotencia definitiva deberá existir en Laravel, con protección defensiva también en Node.js.

## Requisitos

- Node.js 22 o superior;
- npm;
- para producción: Ubuntu 24.04 ARM64, Git, PM2, Nginx y UFW;
- Chromium/Puppeteer compatible con ARM64; el entorno objetivo validado usa `/snap/bin/chromium`.

## Instalación

```bash
npm ci
cp .env.example .env
```

En Linux, use `cp .env.example .env`. Edite `.env` con valores reales. Nunca suba `.env` al repositorio.

## Variables de entorno

| Variable | Propósito |
| --- | --- |
| `NODE_ENV` | Entorno de ejecución. |
| `LARAVEL_API_URL` | URL base de la API privada de Laravel. |
| `LARAVEL_API_TOKEN` | Token de autenticación, únicamente en entorno. |
| `CRON_SCHEDULE` | Intervalo previsto para la consulta (`*/5 * * * *`). |
| `TZ` | Zona horaria explícita (`America/Guayaquil`). |
| `WHATSAPP_CLIENT_ID` | Identificador de la sesión de WhatsApp. |
| `REQUEST_TIMEOUT_MS` | Timeout de solicitudes HTTP. |
| `MAX_RETRIES` | Máximo de reintentos conservadores. |
| `LOG_LEVEL` | Nivel de logging de `pino`. |
| `LOCAL_AUTH_PATH` | Ruta de persistencia de la sesión LocalAuth. |
| `PUPPETEER_EXECUTABLE_PATH` | Ruta opcional a Chromium/Chrome compatible con la arquitectura del servidor. |
| `WHATSAPP_MANUAL_TEST_CONFIRM` | Debe ser exactamente `YES` para permitir un envío manual real. |
| `JOB_LOCK_PATH` | Archivo usado para impedir ejecuciones simultáneas del job. |
| `REMINDER_JOB_ENABLED` | Debe ser `true` solo cuando Laravel y WhatsApp estén validados. |

## Desarrollo y pruebas

```bash
npm test
npm run dev
```

El arranque general valida la configuración. Con `REMINDER_JOB_ENABLED=false` no inicia WhatsApp ni el scheduler.

## Vincular WhatsApp mediante QR

1. Copie `.env.example` a `.env` y configure `WHATSAPP_CLIENT_ID`.
2. Ejecute `npm run whatsapp`.
3. Espere a que aparezca el QR en la terminal.
4. En el teléfono institucional abra **WhatsApp > Dispositivos vinculados > Vincular dispositivo**.
5. Escanee el QR y espere el evento `WhatsApp listo para operar`.
6. Detenga el proceso con `Ctrl+C`. La sesión queda en `LOCAL_AUTH_PATH`.

La sesión persistida contiene credenciales sensibles y nunca debe copiarse al repositorio. Si se revoca el dispositivo, elimine únicamente la carpeta configurada en `LOCAL_AUTH_PATH` y vuelva a vincularlo.

## Prueba manual controlada

Esta orden envía un mensaje real y requiere una confirmación explícita:

```bash
WHATSAPP_MANUAL_TEST_CONFIRM=YES npm run whatsapp:test -- 593991234567 "Mensaje de prueba"
```

En PowerShell:

```powershell
$env:WHATSAPP_MANUAL_TEST_CONFIRM = "YES"
npm run whatsapp:test -- 593991234567 "Mensaje de prueba"
```

La prueba no se habilita por defecto, no forma parte del scheduler y no registra el teléfono completo.

## PM2 y despliegue

El archivo [ecosystem.config.cjs](C:/reservas-wpp/ecosystem.config.cjs) usa una sola instancia en modo `fork`; no se debe usar `cluster` con una sesión WhatsApp.

```bash
npm install --omit=dev
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
pm2 status
pm2 logs misa-whatsapp
pm2 restart misa-whatsapp
```

En Oracle Cloud Ubuntu ARM64:

1. Instale Node.js 22 ARM64, Git y PM2.
2. Instale un Chromium del repositorio de Ubuntu que confirme arquitectura `arm64`.
3. Compruebe `chromium --version` y `dpkg --print-architecture`.
4. Configure `PUPPETEER_EXECUTABLE_PATH` con la ruta real (`which chromium`).
5. Ejecute primero `npm run whatsapp` de forma interactiva y vincule el QR.
6. Verifique que `.wwebjs_auth/` pertenece al usuario que ejecutará PM2.
7. Después inicie PM2 y configure reinicio tras reboot.

No se debe copiar un binario Chromium x86 a ARM64 ni asumir que Puppeteer descargará un navegador compatible. La ruta y dependencias del navegador deben validarse en el servidor objetivo. El proceso requiere permisos de sandbox deshabilitados en la configuración actual; por eso el usuario del servicio y las reglas de red deben estar restringidos.

## Motor de recordatorios

El scheduler consulta cada cinco minutos, pero Laravel decide qué reservas devuelve. Node.js:

1. no consulta la base de datos;
2. no calcula la ventana de 48 horas;
3. no procesa si WhatsApp no está listo;
4. valida y normaliza el número antes de enviar;
5. notifica `sent` solo después de un envío exitoso;
6. notifica `failed` cuando una reserva no puede procesarse;
7. reclama cada reserva mediante `POST /claim` antes de enviar;
8. evita solapamientos mediante `JOB_LOCK_PATH`.

La memoria local evita repetir un id durante la vida del proceso y se ignoran estados `sent` recibidos desde Laravel. La protección definitiva contra duplicados debe ser transaccional en Laravel, porque ningún estado exclusivamente local sobrevive a reinicios ni coordina varias instancias.

Si WhatsApp confirma un envío pero el reporte `sent` a Laravel falla, Node.js no reporta `failed`: hacerlo podría permitir un reintento que duplique el mensaje. Ese caso queda visible en logs como `SENT_CONFIRMATION_FAILED` y requiere reconciliación del lado Laravel.

Si la respuesta de `claim` se pierde, Node tampoco envía `failed`, porque el resultado de la transición puede ser desconocido. El registro queda para reconciliación mediante Laravel antes de cualquier reintento.

## Seguridad y datos personales

- los secretos solo deben vivir en variables de entorno;
- `.env` y la sesión LocalAuth están excluidos del repositorio;
- `pino` redacta tokens y campos sensibles;
- no se deben registrar teléfonos completos: use `maskPhone`;
- no se debe registrar el contenido sensible de las reservas innecesariamente;
- la API Laravel debe utilizar HTTPS y autenticación.

## Contrato requerido en Laravel

Laravel debe exponer una API privada HTTPS:

- `GET /api/internal/reminders/due`
- `POST /api/internal/reminders/{id}/claim`
- `POST /api/internal/reminders/{id}/sent`
- `POST /api/internal/reminders/{id}/failed`

Todas las rutas deben exigir el mismo token Bearer configurado en `LARAVEL_API_TOKEN`.

La respuesta de `due` debe ser un array JSON con al menos:

```json
[
  {
    "id": 123,
    "nombre": "María Rodríguez",
    "telefono": "0991234567",
    "fecha_misa": "2026-09-10",
    "hora_misa": "14:00",
    "lugar": "Parroquia X",
    "estado": "processing"
  }
]
```

Laravel debe seleccionar reservas elegibles y reclamar cada una de forma atómica (`pending` → `processing`) antes de devolverla. La consulta no debe devolver registros `sent`; idealmente tampoco debe devolver `processing` activos, salvo que exista una política explícita de recuperación por timeout.

Node llama a `claim` inmediatamente antes de procesar cada reserva. Laravel debe responder `200 {"claimed":true}` si la transición fue realizada y `409 {"claimed":false}` si otra ejecución ya la reclamó. Node omite la reserva cuando `claimed` es falso.

Al recibir `sent`, Laravel debe actualizar el registro solo si el estado actual es `processing`, guardar `message_id` y `sent_at`, y hacer la operación idempotente. Repetir la misma confirmación no debe crear un segundo envío ni corromper el estado.

Al recibir `failed`, Laravel debe guardar `error_code`, `error_message` y `failed_at`, y aplicar su política de reintento. No deben reintentarse indefinidamente números inválidos.

Esta fase no modifica la aplicación Laravel. Los cambios anteriores son el contrato que deberá implementarse durante la integración final.

<div align="center">

# reservas-wpp

### Recordatorios automáticos por WhatsApp para reservas de misa

`reservas-wpp` es un microservicio independiente en **Node.js** encargado de enviar recordatorios automáticos por WhatsApp a las personas que tienen una reserva para asistir a una misa.

La aplicación principal de reservas ya existe en **Laravel/PHP** y está alojada en **cPanel**. Laravel continúa siendo la fuente principal de datos y `reservas-wpp` actúa como servicio especializado de mensajería.

<br>

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)
![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Chromium](https://img.shields.io/badge/Chromium-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-E95420?style=for-the-badge&logo=ubuntu&logoColor=white)
![Oracle](https://img.shields.io/badge/Oracle_Cloud-F80000?style=for-the-badge&logo=oracle&logoColor=white)

<br>

![Estado](https://img.shields.io/badge/Estado-Integración_Laravel_Pendiente-D97706?style=flat-square)
![Node Service](https://img.shields.io/badge/Node_Service-READY-16A34A?style=flat-square)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Web.js_Implementado-16A34A?style=flat-square)
![Recordatorios](https://img.shields.io/badge/Recordatorios-Automáticos_Deshabilitados-DC2626?style=flat-square)

</div>

---

## Descripción general

El objetivo de `reservas-wpp` es enviar recordatorios aproximadamente **48 horas antes** de una reserva.

Ejemplo:

```text
Reserva:
10 de septiembre de 2026
14:00

Recordatorio:
8 de septiembre de 2026
14:00
```

Mensaje esperado:

```text
Hola María

Te recordamos tu reserva para la Santa Misa.

Fecha: Jueves 10 de septiembre
Hora: 14:00
Lugar: Parroquia X

Te esperamos.
```

El mensaje sale desde el número institucional de WhatsApp vinculado al servidor.

---

## Arquitectura

```text
┌──────────────────────────────┐
│       Laravel / cPanel       │
│                              │
│ Reservas                     │
│ Clientes                     │
│ Fecha / hora                 │
│ Estados                      │
│ Idempotencia                 │
└──────────────┬───────────────┘
               │
               │ API privada HTTPS
               ▼
┌──────────────────────────────┐
│       Oracle Cloud VM        │
│                              │
│        reservas-wpp          │
│          Node.js             │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      whatsapp-web.js         │
│         LocalAuth            │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│    Chromium / Puppeteer      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ WhatsApp institucional      │
│ vinculado mediante QR       │
└──────────────┬───────────────┘
               │
               ▼
        WhatsApp del usuario
```

---

## Responsabilidades

La arquitectura separa claramente las responsabilidades entre Laravel y Node.js.

### Laravel

Laravel es responsable de:

- almacenar las reservas;
- guardar nombre y teléfono del usuario;
- mantener fecha y hora de la misa;
- calcular cuándo corresponde enviar el recordatorio;
- mantener el estado del recordatorio;
- controlar idempotencia;
- evitar duplicados a nivel de negocio;
- exponer una API privada para `reservas-wpp`.

Laravel continúa siendo la **fuente de verdad**.

---

### reservas-wpp

El microservicio Node.js es responsable de:

- consultar periódicamente Laravel;
- obtener recordatorios pendientes;
- reclamar una reserva antes de enviar;
- normalizar teléfonos;
- validar datos necesarios;
- construir el mensaje;
- enviar WhatsApp;
- reportar éxito;
- reportar fallos;
- ejecutar reintentos;
- mantener la sesión de WhatsApp;
- administrar Chromium;
- registrar logs;
- impedir ejecuciones solapadas.

---

## Flujo de envío

El flujo esperado es:

```text
Laravel
   │
   ▼
Reserva pendiente
   │
   ▼
GET /reminders/due
   │
   ▼
Node encuentra recordatorio
   │
   ▼
POST /{id}/claim
   │
   ▼
Reserva reclamada
   │
   ▼
Normalizar teléfono
   │
   ▼
Construir mensaje
   │
   ▼
Enviar WhatsApp
   │
   ├───────────────┐
   │               │
   ▼               ▼
Éxito            Error
   │               │
   ▼               ▼
POST /sent     POST /failed
```

---

## Estados

El flujo principal de estados será:

```text
pending
   │
   ▼
processing
   │
   ▼
sent
```

En caso de error:

```text
pending
   │
   ▼
processing
   │
   ▼
failed
```

El paso `processing` es importante porque evita que dos ejecuciones distintas intenten enviar el mismo recordatorio.

---

## API privada

La integración prevista entre Laravel y Node.js utiliza estos endpoints:

```http
GET /api/internal/reminders/due
```

Obtiene recordatorios pendientes que ya están listos para enviarse.

---

```http
POST /api/internal/reminders/{id}/claim
```

Reclama un recordatorio antes del envío.

Este paso es fundamental para evitar duplicados.

---

```http
POST /api/internal/reminders/{id}/sent
```

Informa a Laravel que el recordatorio fue enviado correctamente.

---

```http
POST /api/internal/reminders/{id}/failed
```

Informa que el intento de envío falló.

---

## Idempotencia

Uno de los objetivos principales es impedir mensajes duplicados.

La lógica esperada es:

```text
1. Buscar recordatorio pendiente
2. Intentar claim
3. Si claim falla:
      no enviar
4. Si claim funciona:
      continuar
5. Enviar WhatsApp
6. Reportar sent o failed
```

El `claim` funciona como mecanismo de exclusión a nivel de negocio.

---

## Automatización

El servicio consulta Laravel aproximadamente cada cinco minutos.

```cron
*/5 * * * *
```

Esto **no significa** que se envíen mensajes cada cinco minutos.

Significa que cada cinco minutos el servicio pregunta:

```text
¿Hay algún recordatorio que ya deba enviarse?
```

Si no existen recordatorios pendientes, no hace nada.

---

## Recordatorio 48 horas antes

Laravel será responsable de determinar cuándo una reserva entra en la ventana de envío.

Ejemplo:

```text
Reserva:
2026-09-10 14:00

Enviar desde:
2026-09-08 14:00
```

El microservicio no necesita calcular reglas de negocio complejas de calendario.

Simplemente consulta los recordatorios que Laravel marque como listos.

---

## WhatsApp

El sistema utiliza:

```text
whatsapp-web.js
LocalAuth
Chromium
Puppeteer
```

No se utiliza inicialmente la API oficial de Meta.

La sesión de WhatsApp se vincula mediante:

```text
WhatsApp
   ↓
Dispositivos vinculados
   ↓
Vincular dispositivo
   ↓
Escanear código QR
```

La autenticación se conserva localmente mediante `LocalAuth`.

---

## Sesión persistente

La sesión de WhatsApp no debe volver a vincularse en cada reinicio.

`whatsapp-web.js` almacena los datos de autenticación en:

```text
.wwebjs_auth/
```

Este directorio debe persistir en el servidor.

Nunca debe subirse al repositorio.

---

## Chromium

El servicio utiliza Chromium en modo headless para ejecutar WhatsApp Web.

Entorno validado:

```text
Chromium 152
ARM64 / aarch64
Ubuntu 24.04
```

Chromium ya fue probado correctamente en el servidor Oracle Cloud.

---

## Scheduler

El scheduler se ejecuta aproximadamente cada cinco minutos.

El servicio incluye un bloqueo para evitar que una nueva ejecución comience mientras la anterior todavía está procesando recordatorios.

Flujo simplificado:

```text
Scheduler inicia
     │
     ▼
¿Ya existe ejecución activa?
     │
 ┌───┴────┐
 │        │
Sí       No
 │        │
 ▼        ▼
Salir   Continuar
          │
          ▼
     Consultar Laravel
```

Esto evita solapamientos innecesarios.

---

## Reintentos

Los fallos temporales pueden necesitar un nuevo intento.

Ejemplos:

- error temporal de conexión;
- Chromium no disponible momentáneamente;
- fallo de comunicación con WhatsApp Web;
- timeout;
- error HTTP temporal de Laravel.

La lógica de reintentos debe ser controlada.

Un fallo permanente no debe provocar reintentos infinitos.

---

## Normalización de teléfonos

Antes del envío, los números deben transformarse a un formato consistente.

Ejemplo Ecuador:

```text
0991234567
```

puede convertirse internamente en:

```text
593991234567
```

Antes de enviar se deben validar:

- código de país;
- cantidad de dígitos;
- caracteres inválidos;
- formato esperado.

---

## Logs

El servicio registra información operativa como:

```text
inicio de scheduler
recordatorios encontrados
claim realizado
envío iniciado
envío exitoso
fallo de envío
reintento
error de Laravel
estado de WhatsApp
```

Los teléfonos no deben registrarse completos.

Ejemplo:

```text
593991234567
```

debería aparecer en logs de forma similar a:

```text
59399*****67
```

Los logs tampoco deben incluir:

- tokens;
- cookies;
- credenciales;
- sesiones;
- secretos;
- encabezados de autorización completos.

---

## Seguridad

La comunicación Laravel ↔ Node.js utilizará autenticación Bearer.

Ejemplo:

```http
Authorization: Bearer TOKEN_PRIVADO
```

El token se almacena exclusivamente en variables de entorno.

Nunca debe existir directamente en el código.

---

## Variables de entorno

Ejemplo conceptual:

```env
NODE_ENV=production

LARAVEL_BASE_URL=https://example.com

LARAVEL_API_TOKEN=change_me

CHECK_INTERVAL_MS=300000

WHATSAPP_CLIENT_ID=reservas-wpp

CHROMIUM_PATH=/usr/bin/chromium
```

Los nombres reales pueden variar dependiendo de la implementación final.

---

## Archivos que nunca deben subirse

El repositorio debe excluir:

```text
.env
.env.*
!.env.example

node_modules/

.wwebjs_auth/
.wwebjs_cache/

logs/
*.log

tokens
credenciales
claves privadas
cookies
sesiones
```

Ejemplo de `.gitignore`:

```gitignore
node_modules/

.env
.env.*
!.env.example

.wwebjs_auth/
.wwebjs_cache/

logs/
*.log

.DS_Store
```

---

## Infraestructura de producción

El microservicio está pensado para ejecutarse en Oracle Cloud.

### Servidor

```text
Oracle Cloud
US East — Ashburn

Ampere A1 Flex

2 OCPU
12 GB RAM
50 GB almacenamiento
Ubuntu 24.04
ARM64 / aarch64
```

---

### Software instalado

```text
Node.js 22.23.2
npm 10.9.8
PM2 7.0.4
Chromium 152 ARM64
Git
Nginx
UFW
Fail2ban
```

El servidor también dispone de:

```text
2 GB de swap
```

---

## Gestión con PM2

PM2 será responsable de mantener el proceso activo.

Ejemplo:

```bash
pm2 start ecosystem.config.cjs
```

Después:

```bash
pm2 save
```

y:

```bash
pm2 startup
```

Esto permite que `reservas-wpp` vuelva a iniciarse automáticamente después de un reinicio del servidor.

---

## Separación con MercadoVoz

El mismo servidor también ejecuta MercadoVoz.

Ambos proyectos permanecen completamente separados.

Estructura:

```text
/home/ubuntu/apps/
│
├── mercadovoz/
│
└── misa-whatsapp/
```

Cada aplicación posee:

- su propio repositorio;
- sus dependencias;
- sus variables de entorno;
- sus logs;
- su proceso PM2;
- su ciclo de despliegue.

---

## Estructura del proyecto

Una estructura posible para el repositorio:

```text
reservas-wpp/
│
├── src/
│   ├── config/
│   ├── whatsapp/
│   ├── laravel/
│   ├── scheduler/
│   ├── reminders/
│   ├── utils/
│   └── index.js
│
├── logs/
│
├── .env.example
├── .gitignore
├── ecosystem.config.cjs
├── package.json
├── package-lock.json
└── README.md
```

Una distribución conceptual:

```text
src/
│
├── config/
│   └── env.js
│
├── laravel/
│   └── client.js
│
├── whatsapp/
│   ├── client.js
│   └── message.js
│
├── scheduler/
│   └── scheduler.js
│
├── reminders/
│   ├── processReminder.js
│   └── normalizePhone.js
│
├── utils/
│   ├── logger.js
│   └── maskPhone.js
│
└── index.js
```

---

## Desarrollo local

### Requisitos

```text
Node.js
npm
Chromium
Git
```

---

### Clonar

```bash
git clone git@github.com:lildavicho/reservas-wpp.git
```

Entrar al proyecto:

```bash
cd reservas-wpp
```

---

### Instalar dependencias

```bash
npm install
```

---

### Configurar entorno

Crear:

```text
.env
```

a partir de:

```text
.env.example
```

Ejemplo:

```bash
cp .env.example .env
```

Después configurar los valores necesarios.

---

### Ejecutar

Dependiendo de los scripts definidos:

```bash
npm start
```

o:

```bash
npm run dev
```

---

## Primera vinculación de WhatsApp

En la primera ejecución, si todavía no existe sesión:

```text
Node
  ↓
whatsapp-web.js
  ↓
Chromium
  ↓
QR generado
```

Luego, desde el teléfono institucional:

```text
WhatsApp
→ Dispositivos vinculados
→ Vincular dispositivo
→ Escanear QR
```

Una vez vinculada la sesión, `LocalAuth` permite conservarla.

---

## Despliegue

Flujo previsto:

```text
GitHub
   │
   ▼
Oracle Cloud
   │
   ▼
git pull / git clone
   │
   ▼
npm install
   │
   ▼
configurar .env
   │
   ▼
validar Chromium
   │
   ▼
vincular WhatsApp
   │
   ▼
PM2
   │
   ▼
Integrar Laravel
```

---

## Estado actual

| Componente | Estado |
|---|---|
| Servicio Node.js | READY |
| Arquitectura Node | READY |
| whatsapp-web.js | Implementado |
| LocalAuth | Implementado |
| QR | Implementado |
| Scheduler | Implementado |
| Lock contra solapamientos | Implementado |
| Cliente Laravel | Implementado |
| Claim antes de enviar | Implementado |
| Reintentos | Implementado |
| Logs | Implementado |
| Configuración PM2 | Preparada |
| Base Oracle Cloud | READY |
| Chromium ARM64 | Validado |
| Integración Laravel | Pendiente |
| WhatsApp institucional | Pendiente |
| Despliegue final Oracle | Pendiente |
| Recordatorios automáticos | Deshabilitados |

---

## Estado operativo

Actualmente el sistema está intencionalmente en:

```text
AUTO_REMINDERS = DISABLED
```

Los recordatorios automáticos no deben habilitarse hasta completar:

```text
Integración Laravel
        │
        ▼
Validación de API
        │
        ▼
Pruebas de claim
        │
        ▼
Pruebas de idempotencia
        │
        ▼
WhatsApp institucional
        │
        ▼
Pruebas controladas
        │
        ▼
Producción
```

Esto evita enviar mensajes reales antes de terminar la integración.

---

## Roadmap

```text
Servicio Node
     ✅
      │
WhatsApp Web
     ✅
      │
LocalAuth
     ✅
      │
Scheduler
     ✅
      │
Lock
     ✅
      │
Cliente Laravel
     ✅
      │
Claim / sent / failed
     ✅
      │
Reintentos
     ✅
      │
Logs
     ✅
      │
Oracle base
     ✅
      │
Chromium ARM64
     ✅
      │
Integración Laravel
     ⏳
      │
WhatsApp institucional
     ⏳
      │
Pruebas reales
     ⏳
      │
Activar recordatorios
     ⏳
```

---

## Consideraciones importantes

Este proyecto utiliza automatización basada en WhatsApp Web mediante una biblioteca no oficial.

Eso implica que:

- depende del funcionamiento de WhatsApp Web;
- cambios de WhatsApp pueden afectar la integración;
- la sesión puede requerir nueva autenticación;
- no posee las mismas garantías de estabilidad que una API oficial;
- debe utilizarse respetando las políticas aplicables de WhatsApp.

La arquitectura está diseñada de forma que la lógica de negocio permanezca en Laravel y el mecanismo de mensajería pueda reemplazarse en el futuro si fuera necesario.

Por ejemplo:

```text
Laravel
   │
   ▼
Reminder API
   │
   ├── whatsapp-web.js
   │
   └── futura API oficial
```

---

## Principios del proyecto

### Laravel sigue siendo la fuente de verdad

Node.js no debe convertirse en una segunda base de datos de reservas.

### Claim antes del envío

Nunca se debe intentar enviar sin reclamar primero la operación.

### Evitar duplicados

La idempotencia es más importante que enviar unos segundos antes.

### Secretos fuera del repositorio

Tokens y sesiones permanecen exclusivamente en el entorno de producción.

### Logs sin información sensible

Los teléfonos deben enmascararse y los secretos nunca deben imprimirse.

### Separación de servicios

MercadoVoz y `reservas-wpp` comparten servidor, no arquitectura.

---

## Repositorio

```text
https://github.com/lildavicho/reservas-wpp
```

---

## Autor

**David Mendez**

Full-Stack Developer  
Universidad Católica de Cuenca  
Cuenca, Ecuador

[![GitHub](https://img.shields.io/badge/GitHub-lildavicho-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/lildavicho)

---

<div align="center">

### reservas-wpp

**Recordatorios de reservas por WhatsApp con control de idempotencia y separación clara de responsabilidades.**

<sub>Node.js · WhatsApp Web · Laravel · Oracle Cloud</sub>

</div>

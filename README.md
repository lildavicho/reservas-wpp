<div align="center">

# reservas-wpp

### Recordatorios automáticos por WhatsApp para reservas de misa

Microservicio en **Node.js** encargado de consultar reservas desde una aplicación Laravel y enviar recordatorios automáticos por WhatsApp aproximadamente **48 horas antes** de cada misa.

<br>

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Laravel](https://img.shields.io/badge/Laravel-FF2D20?style=for-the-badge&logo=laravel&logoColor=white)
![Oracle Cloud](https://img.shields.io/badge/Oracle_Cloud-F80000?style=for-the-badge&logo=oracle&logoColor=white)

<br>

![Estado](https://img.shields.io/badge/Estado-Integración_Final_Pendiente-D97706?style=flat-square)
![WhatsApp](https://img.shields.io/badge/WhatsApp_Web-Implementado-16A34A?style=flat-square)
![Chromium](https://img.shields.io/badge/Chromium_ARM64-Validado-16A34A?style=flat-square)

</div>

---

## Qué hace

Cuando una persona reserva una misa, Laravel conserva toda la información de la reserva.

`reservas-wpp` consulta periódicamente cuáles deben notificarse y envía un mensaje desde el **WhatsApp institucional**.

Ejemplo:

```text
Reserva
10 septiembre 2026
14:00

        ↓ 48 horas antes

Hola María

Te recordamos tu reserva para la Santa Misa.

Fecha: 10 de septiembre
Hora: 14:00
Lugar: Parroquia X
```

El objetivo del microservicio es ocuparse únicamente del envío de mensajes.

Laravel sigue siendo la **fuente de verdad**.

---

## Arquitectura

```text
┌───────────────────────────┐
│      Laravel / cPanel     │
│                           │
│ Reservas                  │
│ Clientes                  │
│ Fecha / hora              │
│ Estado del recordatorio   │
│ Idempotencia              │
└─────────────┬─────────────┘
              │
              │ API privada HTTPS
              ▼
┌───────────────────────────┐
│       reservas-wpp        │
│          Node.js          │
│                           │
│ Scheduler                 │
│ Claim                     │
│ Reintentos                │
│ Logs                      │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│     whatsapp-web.js       │
│        LocalAuth          │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│   Chromium / Puppeteer    │
└─────────────┬─────────────┘
              │
              ▼
     WhatsApp institucional
              │
              ▼
      WhatsApp del usuario
```

---

## Flujo

```text
Scheduler
   │
   ▼
Consultar recordatorios pendientes
   │
   ▼
GET /reminders/due
   │
   ▼
Claim del recordatorio
   │
   ▼
POST /{id}/claim
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
   ├──────────────┐
   ▼              ▼
 éxito          error
   │              │
   ▼              ▼
 /sent          /failed
```

El `claim` evita que dos procesos envíen el mismo recordatorio.

---

## API Laravel ↔ Node

```http
GET  /api/internal/reminders/due
POST /api/internal/reminders/{id}/claim
POST /api/internal/reminders/{id}/sent
POST /api/internal/reminders/{id}/failed
```

Flujo de estados:

```text
pending
   ↓
processing
   ↓
sent
```

o:

```text
pending
   ↓
processing
   ↓
failed
```

---

## Automatización

El servicio consulta Laravel aproximadamente cada cinco minutos:

```cron
*/5 * * * *
```

Esto no significa que envíe mensajes cada cinco minutos.

Solo verifica si existe alguna reserva que haya entrado en su ventana de recordatorio.

---

## Stack

### Aplicación

![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=flat-square&logo=javascript&logoColor=F7DF1E)
![whatsapp-web.js](https://img.shields.io/badge/whatsapp--web.js-25D366?style=flat-square&logo=whatsapp&logoColor=white)

### Automatización

![Chromium](https://img.shields.io/badge/Chromium-152-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Puppeteer](https://img.shields.io/badge/Puppeteer-40B5A4?style=flat-square&logo=puppeteer&logoColor=white)
![PM2](https://img.shields.io/badge/PM2-2B037A?style=flat-square&logo=pm2&logoColor=white)

### Infraestructura

![Ubuntu](https://img.shields.io/badge/Ubuntu-24.04-E95420?style=flat-square&logo=ubuntu&logoColor=white)
![Oracle Cloud](https://img.shields.io/badge/Oracle_Cloud-Ampere_A1-F80000?style=flat-square&logo=oracle&logoColor=white)

---

## Producción

El microservicio está preparado para ejecutarse en:

```text
Oracle Cloud — Ashburn

Ampere A1 Flex
2 OCPU
12 GB RAM
Ubuntu 24.04 ARM64
Node.js 22.23.2
Chromium 152
PM2
2 GB swap
```

Estructura del servidor:

```text
/home/ubuntu/apps/
├── mercadovoz/
└── misa-whatsapp/
```

Ambos proyectos funcionan de forma independiente.

---

## Seguridad

La comunicación entre Laravel y Node utiliza:

```http
Authorization: Bearer TOKEN_PRIVADO
```

Los secretos permanecen únicamente en `.env`.

No deben subirse:

```text
.env
.wwebjs_auth/
.wwebjs_cache/
node_modules/
logs/
tokens
credenciales
claves privadas
```

Los teléfonos deben aparecer en logs de forma enmascarada.

Ejemplo:

```text
59399*****67
```

---

## Estado

| Componente | Estado |
|---|---|
| Servicio Node.js | Listo |
| whatsapp-web.js | Implementado |
| LocalAuth | Implementado |
| QR | Implementado |
| Scheduler | Implementado |
| Lock contra solapamientos | Implementado |
| Cliente Laravel | Implementado |
| Claim antes del envío | Implementado |
| Reintentos | Implementado |
| Logs | Implementado |
| PM2 | Preparado |
| Chromium ARM64 | Validado |
| Integración Laravel | Pendiente |
| WhatsApp institucional | Pendiente |
| Despliegue final | Pendiente |
| Envíos automáticos | Deshabilitados |

---

## Principio de diseño

```text
Laravel decide QUÉ debe enviarse.

reservas-wpp decide CÓMO enviarlo.
```

Esto mantiene separada la lógica de negocio de la infraestructura de WhatsApp.

Si en el futuro cambia el proveedor de mensajería, Laravel no necesita ser rediseñado.

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

## Autor

**David Mendez**  
Full-Stack Developer  
Universidad Católica de Cuenca  
Cuenca, Ecuador

[![GitHub](https://img.shields.io/badge/GitHub-lildavicho-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/lildavicho)

---

<div align="center">

### reservas-wpp

**Un microservicio pequeño con una responsabilidad clara: enviar el recordatorio correcto, una sola vez y en el momento adecuado.**

</div>

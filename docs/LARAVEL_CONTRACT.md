# Contrato de integración Laravel

Laravel expondrá estas rutas bajo HTTPS:

| Método | Ruta | Propósito |
| --- | --- | --- |
| GET | `/api/internal/reminders/due` | Listar recordatorios vencidos y pendientes |
| POST | `/api/internal/reminders/{id}/claim` | Reclamar atómicamente una reserva |
| POST | `/api/internal/reminders/{id}/sent` | Confirmar envío exitoso |
| POST | `/api/internal/reminders/{id}/failed` | Registrar fallo antes del envío |

Todas requieren `Authorization: Bearer <LARAVEL_API_TOKEN>`. Laravel debe comparar el token de forma segura y no registrarlo.

## `due`

Respuesta `200`:

```json
[
  {
    "id": 123,
    "nombre": "Nombre de prueba",
    "telefono": "0990000000",
    "fecha_misa": "2026-09-10",
    "hora_misa": "14:00",
    "lugar": "Parroquia de prueba"
  }
]
```

Debe incluir solo reservas `reminder_at <= now`, estado `pending` y no enviadas. Laravel sigue siendo responsable de interpretar la fecha en `America/Guayaquil`.

## `claim`

Node envía `POST` con `{}`. Laravel debe ejecutar una actualización condicional equivalente a:

```sql
UPDATE reservas
SET reminder_status = 'processing',
    reminder_claimed_at = CURRENT_TIMESTAMP,
    reminder_attempts = reminder_attempts + 1
WHERE id = ?
  AND reminder_status = 'pending';
```

Éxito: `200 {"claimed": true}`. Si no se actualizó ninguna fila: `409 {"claimed": false}`.

## `sent`

Payload:

```json
{
  "message_id": "wamid.example",
  "sent_at": "2026-09-08T19:00:00.000Z"
}
```

Debe cambiar `processing` a `sent`, guardar ambos campos y limpiar el error anterior. La operación debe ser idempotente y no volver a reclamar una reserva enviada.

## `failed`

Payload:

```json
{
  "error_code": "INVALID_PHONE",
  "error_message": "Número inválido",
  "failed_at": "2026-09-08T19:00:00.000Z"
}
```

Debe guardar el error y decidir explícitamente si el registro queda `failed` o puede reintentarse. No se debe volver automáticamente a `pending` cuando exista posibilidad de que WhatsApp ya haya enviado el mensaje.

## Reconciliación

Una reserva en `processing` no debe liberarse automáticamente sin una política revisada. Si Node perdió la respuesta de `sent`, Laravel debe consultar/reconciliar el `message_id` o revisar manualmente antes de reabrirla.

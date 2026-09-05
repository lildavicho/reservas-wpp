# Seguridad

- Nunca subir `.env`, tokens, claves, cookies, QR ni `.wwebjs_auth/`.
- Usar HTTPS y Bearer Token para Laravel.
- Mantener el token únicamente en variables de entorno.
- No registrar teléfonos completos ni contenido innecesario de reservas.
- Mantener `REMINDER_JOB_ENABLED=false` mientras no exista integración Laravel validada.
- Ejecutar PM2 con un usuario de servicio sin privilegios innecesarios.
- Revisar `npm audit --omit=dev` antes de producción.
- No ejecutar `npm audit fix --force` sin revisar compatibilidad con `whatsapp-web.js`.

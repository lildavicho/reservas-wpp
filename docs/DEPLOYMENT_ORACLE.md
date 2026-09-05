# Despliegue en Oracle Cloud ARM64

## Entorno validado

- Ubuntu 24.04;
- arquitectura `aarch64`;
- Node.js 22.23.2;
- npm 10.9.8;
- PM2 7.0.4;
- Chromium 152 ARM64;
- Chromium en `/snap/bin/chromium`.

La ruta se configura, no se hardcodea:

```dotenv
PUPPETEER_EXECUTABLE_PATH=/snap/bin/chromium
```

## Instalación

```bash
git clone git@github.com:lildavicho/reservas-wpp.git
cd reservas-wpp
npm ci --omit=dev
cp .env.example .env
```

Configure el `.env` con el token real fuera de Git. Para una primera validación, mantenga `REMINDER_JOB_ENABLED=false`.

## Chromium y WhatsApp

Compruebe arquitectura y navegador:

```bash
uname -m
node --version
pm2 --version
chromium --version
test -x /snap/bin/chromium
```

Puppeteer usa:

- `headless: true`;
- `--no-sandbox`;
- `--disable-setuid-sandbox`.

No copie binarios x86. La sesión `LocalAuth` debe estar en `.wwebjs_auth/`, con permisos del mismo usuario que ejecuta PM2, y nunca debe subirse al repositorio.

## Vinculación y activación

```bash
REMINDER_JOB_ENABLED=false npm run whatsapp
```

Escanee el QR desde el teléfono institucional y confirme el evento `ready`. Después configure `REMINDER_JOB_ENABLED=true` y arranque:

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
pm2 status
pm2 logs reservas-wpp
```

No active el scheduler hasta comprobar el contrato Laravel y realizar una prueba controlada.

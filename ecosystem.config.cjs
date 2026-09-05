module.exports = {
  apps: [{
    name: 'reservas-wpp',
    script: 'src/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    restart_delay: 5000,
    max_restarts: 10,
    watch: false,
    max_memory_restart: '512M',
    time: true,
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    env: {
      NODE_ENV: 'production',
      REMINDER_JOB_ENABLED: 'true'
    }
  }]
};

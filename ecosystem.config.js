export default {
  apps: [
    {
      name: 'costra-backend',
      script: 'server/server.js',
      cwd: '/home/vagrant/costra',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
}

# PM2 Process Management Setup

PM2 is a production process manager for Node.js applications. It keeps your application alive forever, reloads it without downtime, and facilitates common system admin tasks.

## Installation

PM2 is already installed globally. If you need to reinstall:

```bash
npm install -g pm2
```

## Quick Start

### Start Backend Server
```bash
npm run server:start
# Or directly:
pm2 start ecosystem.config.js --only costra-backend
```

### Stop Backend Server
```bash
npm run server:stop
# Or directly:
pm2 stop costra-backend
```

### Restart Backend Server
```bash
npm run server:restart
# Or directly:
pm2 restart costra-backend
```

### View Logs
```bash
npm run server:logs
# Or directly:
pm2 logs costra-backend
```

### Check Status
```bash
npm run server:status
# Or directly:
pm2 status
```

## PM2 Commands

### Basic Commands
```bash
# List all processes
pm2 list
pm2 status

# View logs
pm2 logs costra-backend          # All logs
pm2 logs costra-backend --lines 50  # Last 50 lines
pm2 logs costra-backend --err     # Error logs only
pm2 logs costra-backend --out     # Output logs only

# Monitor
pm2 monit

# Stop/Start/Restart
pm2 stop costra-backend
pm2 start costra-backend
pm2 restart costra-backend
pm2 reload costra-backend         # Zero-downtime reload

# Delete
pm2 delete costra-backend

# Save current process list
pm2 save

# Startup script (auto-start on system boot)
pm2 startup
pm2 save
```

### Advanced Commands
```bash
# Show detailed info
pm2 show costra-backend

# Reset restart counter
pm2 reset costra-backend

# Flush logs
pm2 flush

# Reload all apps
pm2 reload all

# Stop all apps
pm2 stop all
```

## Configuration

The PM2 configuration is in `ecosystem.config.js`:

```javascript
{
  name: 'costra-backend',
  script: './server/server.js',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'development',
    PORT: 3001,
  },
  error_file: './logs/backend-error.log',
  out_file: './logs/backend-out.log',
  autorestart: true,
  watch: false,
  max_memory_restart: '1G',
}
```

## Logs

Logs are stored in the `logs/` directory:
- `logs/backend-error.log` - Error logs
- `logs/backend-out.log` - Output logs

View logs in real-time:
```bash
pm2 logs costra-backend
```

Or tail the log files directly:
```bash
tail -f logs/backend-out.log
tail -f logs/backend-error.log
```

## Auto-Start on System Boot

To make PM2 start automatically on system boot:

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

This will configure PM2 to start your applications when the system reboots.

## Monitoring

### Real-time Monitoring
```bash
pm2 monit
```

This shows:
- CPU usage
- Memory usage
- Logs
- Process status

### Web Dashboard (Optional)
```bash
pm2 plus
```

## Production Deployment

For production:

1. Update `ecosystem.config.js`:
   - Set `NODE_ENV: 'production'`
   - Adjust `instances` for cluster mode if needed
   - Configure proper log rotation

2. Start with production config:
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

3. Set up log rotation:
   ```bash
   pm2 install pm2-logrotate
   ```

## Troubleshooting

### Process won't start
```bash
# Check logs
pm2 logs costra-backend --err

# Check status
pm2 show costra-backend

# Restart
pm2 restart costra-backend
```

### High memory usage
- Check `max_memory_restart` in config
- Monitor with `pm2 monit`
- Restart if needed: `pm2 restart costra-backend`

### Logs not appearing
```bash
# Flush logs
pm2 flush

# Check log file permissions
ls -la logs/
```

## Useful PM2 Modules

```bash
# Log rotation
pm2 install pm2-logrotate

# Web interface
pm2 install pm2-server-monit

# Process monitoring
pm2 install pm2-logging
```

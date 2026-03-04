# Troubleshooting Guide

## "Failed to fetch" Error on Signup/Login

This error typically means the frontend cannot connect to the backend server. Here's how to fix it:

### 1. Check if Backend Server is Running

```bash
cd server
npm run dev
```

You should see:
```
Server running on http://localhost:3001
Connected to PostgreSQL database
Database schema initialized successfully
```

### 2. Check Database Connection

Make sure PostgreSQL is running and the database exists:

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list  # macOS

# Test database connection
psql postgresql://postgres:postgres@localhost:5432/costra
```

### 3. Verify Environment Variables

Check `server/.env` file exists and has correct values:

```bash
cd server
cat .env
```

Should contain:
```
PORT=3001
JWT_SECRET=your-secret-key
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/costra
```

### 4. Check CORS Configuration

The backend should allow requests from `http://localhost:5173`. Check `server/server.js`:

```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:5173',
  credentials: true,
}))
```

### 5. Check Browser Console

Open browser DevTools (F12) and check:
- **Console tab**: Look for detailed error messages
- **Network tab**: Check if the request is being made and what the response is

### 6. Common Issues

#### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Start PostgreSQL service
```bash
sudo systemctl start postgresql  # Linux
brew services start postgresql  # macOS
```

#### Database Does Not Exist
```
error: database "costra" does not exist
```
**Solution**: Create the database
```bash
createdb costra
# Or: psql -c "CREATE DATABASE costra;"
```

#### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3001
```
**Solution**: Kill the process using port 3001 or change the port
```bash
# Find and kill process
lsof -ti:3001 | xargs kill -9
# Or change PORT in server/.env
```

#### JWT_SECRET Not Set
```
Error: secretOrPrivateKey must have a value
```
**Solution**: Set JWT_SECRET in `server/.env`
```
JWT_SECRET=your-strong-secret-key-here
```

### 7. Test Backend Directly

Test if the backend is responding:

```bash
# Health check
curl http://localhost:3001/api/health

# Should return: {"status":"ok","message":"Costra API is running"}
```

### 8. Check Frontend API URL

Verify the frontend is using the correct API URL. Check browser console for the actual URL being called.

The default is `http://localhost:3001/api`. You can override with environment variable:

Create `.env` in project root:
```
VITE_API_URL=http://localhost:3001/api
```

### 9. Network/Firewall Issues

- Make sure no firewall is blocking port 3001
- If using a VM, ensure port forwarding is set up
- Check if you can access `http://localhost:3001/api/health` in your browser

### 10. Still Not Working?

1. **Check server logs** for detailed error messages
2. **Check browser Network tab** to see the exact request/response
3. **Verify both frontend and backend are running** in separate terminals
4. **Try restarting both servers**

## Database Connection Issues

### PostgreSQL Not Running
```bash
# Start PostgreSQL
sudo systemctl start postgresql  # Linux
brew services start postgresql  # macOS
```

### Wrong Database URL
Check `server/.env`:
```
DATABASE_URL=postgresql://username:password@host:port/database
```

### Permission Denied
```sql
GRANT ALL PRIVILEGES ON DATABASE costra TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
```

## Still Having Issues?

1. Check server terminal for error messages
2. Check browser console for detailed errors
3. Verify all dependencies are installed: `npm install` in both root and server directories
4. Make sure Node.js version is 18+

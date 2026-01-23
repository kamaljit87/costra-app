# AWS Amplify Quick Start

## Prerequisites Checklist

- [ ] AWS Account created
- [ ] Backend API deployed (EC2/ECS/Elastic Beanstalk)
- [ ] PostgreSQL database set up (RDS or external)
- [ ] Backend API URL ready (e.g., `https://api.yourdomain.com`)
- [ ] Git repository ready (GitHub/GitLab/Bitbucket)

## 5-Minute Setup

### 1. Connect Repository (2 minutes)

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Click **"New app"** → **"Host web app"**
3. Connect your Git provider
4. Select repository and branch

### 2. Configure Environment Variable (1 minute)

In Amplify console → **App settings** → **Environment variables**:

```
VITE_API_URL = https://your-backend-api-url.com/api
```

**Important:** Replace with your actual backend API URL.

### 3. Deploy (2 minutes)

1. Click **"Save and deploy"**
2. Wait for build to complete (~2-3 minutes)
3. Your app will be live at: `https://main.xxxxx.amplifyapp.com`

## Backend Deployment (If Not Done)

### Quick Option: Elastic Beanstalk

```bash
cd server
pip install awsebcli
eb init -p node.js-18 costra-backend
eb create costra-production
eb setenv DATABASE_URL=postgresql://... JWT_SECRET=... NODE_ENV=production FRONTEND_URL=https://main.xxxxx.amplifyapp.com
eb deploy
```

### Database: AWS RDS

1. RDS Console → Create database
2. Choose PostgreSQL
3. Set master username/password
4. Note the endpoint URL
5. Update `DATABASE_URL` in backend

## Environment Variables Reference

### Frontend (Amplify)
```
VITE_API_URL=https://api.yourdomain.com/api
```

### Backend (EC2/ECS/EB)
```
DATABASE_URL=postgresql://user:pass@host:5432/costra
JWT_SECRET=your-32-char-secret-key
NODE_ENV=production
FRONTEND_URL=https://main.xxxxx.amplifyapp.com
PORT=3001
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Common Issues

### Build Fails
- Check Node.js version (needs 18+)
- Verify `amplify.yml` exists in repo root
- Check build logs in Amplify console

### API Not Connecting
- Verify `VITE_API_URL` is set correctly
- Check backend CORS allows Amplify domain
- Verify backend is running and accessible

### CORS Errors
Add your Amplify URL to backend CORS:
```javascript
origin: [
  process.env.FRONTEND_URL,
  'https://main.xxxxx.amplifyapp.com'
]
```

## Next Steps

1. **Custom Domain:** Add domain in Amplify → Domain management
2. **Monitoring:** Set up CloudWatch alarms
3. **Backups:** Configure RDS automated backups
4. **SSL:** Amplify provides SSL automatically

## Full Documentation

See `AWS_AMPLIFY_DEPLOYMENT.md` for detailed deployment guide.

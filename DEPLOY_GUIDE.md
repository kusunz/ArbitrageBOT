# Free VPS Deployment Guide

## Oracle Cloud (Recommended)

**1. Sign up:** https://www.oracle.com/cloud/free/
**2. Create Ubuntu VM (Always Free tier)**
**3. SSH into VM and run:**

```bash
curl -fsSL https://raw.githubusercontent.com/kusunz/ArbitrageBOT/master/deploy-oracle.sh | bash
```

**4. Configure:**
```bash
cd ~/ArbitrageBOT
nano .env  # Add Telegram credentials
npm run build
pm2 start dist/index.js --name arbitrage-bot
pm2 save
```

**Monitor:**
```bash
pm2 logs
pm2 status
```

Full guide: https://github.com/kusunz/ArbitrageBOT#deployment

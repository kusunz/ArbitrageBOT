#!/bin/bash
# Oracle Cloud VM Setup Script for ArbitrageBOT

echo "=== ArbitrageBOT Oracle Cloud Setup ==="

# Update system
echo "Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
echo "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git
echo "Installing Git..."
sudo apt-get install -y git

# Clone repository
echo "Cloning repository..."
cd ~
git clone https://github.com/kusunz/ArbitrageBOT.git
cd ArbitrageBOT

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env file
echo "Creating .env file..."
cat > .env << 'EOF'
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Configuration
ARBITRAGE_THRESHOLD=3
VOLUME_SPIKE_THRESHOLD=3
MIN_ABSOLUTE_VOLUME=500000
HOT_LIST_SIZE=50
SCAN_INTERVAL=300000

# Order Book Verification
ORDER_BOOK_VERIFICATION=true
EOF

echo ""
echo "=== Setup Instructions ==="
echo "1. Edit .env file with your Telegram credentials:"
echo "   nano .env"
echo ""
echo "2. Build the project:"
echo "   npm run build"
echo ""
echo "3. Run the bot:"
echo "   npm start"
echo ""
echo "4. Run in background (recommended):"
echo "   npm install -g pm2"
echo "   pm2 start dist/index.js --name arbitrage-bot"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "=== Useful PM2 Commands ==="
echo "pm2 status          - Check bot status"
echo "pm2 logs            - View logs"
echo "pm2 restart all     - Restart bot"
echo "pm2 stop all        - Stop bot"
echo ""

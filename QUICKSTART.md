# Quick Start Guide

## 1. Installation

The project is already set up! Dependencies are installed and the code is compiled.

## 2. Configuration

Edit the `.env` file to configure your bot:

```bash
# Optional: Telegram Bot (recommended for notifications)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Arbitrage Settings (defaults are good to start)
ARBITRAGE_THRESHOLD=3
VOLUME_SPIKE_THRESHOLD=3
MIN_ABSOLUTE_VOLUME=500000
HOT_LIST_SIZE=50
SCAN_INTERVAL=300000
```

### Setting up Telegram (Optional)

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow instructions to create a bot
3. Copy the bot token you receive
4. Search for [@userinfobot](https://t.me/userinfobot) and send `/start`
5. Copy your chat ID
6. Paste both into `.env` file

**Note:** Telegram is optional. If not configured, the bot will only log to console.

## 3. Run the Bot

### Development Mode (with TypeScript):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

## 4. What to Expect

When you start the bot, you'll see:

```
[2025-01-04 12:00:00] ℹ️  🤖 Initializing Arbitrage Bot...
[2025-01-04 12:00:00] ℹ️  ============================================================
[2025-01-04 12:00:00] ℹ️  Configuration:
[2025-01-04 12:00:00] ℹ️    • Arbitrage Threshold: 3%
[2025-01-04 12:00:01] ℹ️    • Volume Spike Threshold: 3x
...
[2025-01-04 12:00:05] ℹ️  Fetching top 1300 coins from CoinGecko...
...
[2025-01-04 12:01:00] ✅ Fetched 1300 coins successfully
[2025-01-04 12:01:00] ✅ ✅ Bot initialized successfully!
[2025-01-04 12:01:00] ✅ 🚀 Starting Arbitrage Bot...
[2025-01-04 12:01:00] ℹ️  📊 Volume scans scheduled every 300 seconds
[2025-01-04 12:01:00] ℹ️  💰 Arbitrage scans scheduled every 30 seconds
[2025-01-04 12:01:00] ✅ 🎯 Bot is now actively monitoring for opportunities!
```

## 5. Understanding the Bot's Behavior

### Volume Scanning (Every 5 minutes)
- Scans top 200 coins for trading volume activity
- Identifies volume spikes (3x+ normal)
- Detects high absolute volume (>$500k in 5 min)
- Finds cross-exchange volume disparities
- Updates the "Hot List" with active coins

### Arbitrage Scanning (Every 30 seconds)
- Scans only coins in the Hot List
- Checks prices across 20 CEXs
- Calculates all fees (trading, withdrawal, gas)
- Reports opportunities with 3%+ net profit

### When Opportunities Are Found

You'll see console output like:
```
============================================================
💰 ARBITRAGE OPPORTUNITY

💱 Type: SIMPLE
Symbol: BTC/USDT

📍 Buy: binance @ $43,250.50
📍 Sell: bybit @ $43,450.75

💵 Price Difference: 0.46%
💰 Estimated Profit: $200.25

📊 Fee Breakdown:
  • Trading Fees: $0.20
  • Withdrawal Fee: $5.00
  • Gas Fee: $0.00
  • Total Fees: $5.20

✅ NET PROFIT: $195.05 (3.90%)
💼 Trade Amount: $100
============================================================
```

If Telegram is configured, you'll also receive notifications there!

## 6. Important Notes

### First Run
- The first scan takes ~5-10 minutes to fetch all coin data from CoinGecko
- Be patient! The free API has rate limits
- After initial load, scans are much faster

### API Rate Limits
- CoinGecko free tier: 50 calls/minute
- The bot respects these limits with smart caching
- If you see rate limit errors, wait 1 hour

### No Arbitrage Found?
This is normal! The market is often efficient. Opportunities appear during:
- High volatility periods
- New coin listings
- Market crashes/pumps
- Exchange maintenance periods

To see more opportunities (with lower profit):
- Reduce `ARBITRAGE_THRESHOLD` to 1-2% in `.env`
- Increase `HOT_LIST_SIZE` to 100

### Performance
- CPU usage: Low (~5%)
- Memory usage: ~200-300MB
- Network: Periodic API calls (minimal)

## 7. Stopping the Bot

Press `Ctrl + C` to gracefully shut down the bot.

## 8. Troubleshooting

**"Failed to fetch coin list"**
- Check internet connection
- CoinGecko might be rate-limited, wait 1 hour
- Try again later

**"Telegram not configured"**
- This is just a warning
- Bot still works, just no Telegram notifications
- Add credentials to `.env` if you want notifications

**Build errors**
- Run `npm install` again
- Make sure you have Node.js 16+ installed

**No hot coins in the list**
- Market might be calm
- Wait for volume scanning cycles
- Lower `VOLUME_SPIKE_THRESHOLD` to 2 in `.env`

## 9. Next Steps

### Monitor the Bot
- Watch console logs for opportunities
- Check Hot List stats to see active coins
- Monitor Telegram for instant alerts

### Extend to Auto-Trading (Future)
The bot is designed for easy extension:
1. Add exchange API keys to `.env`
2. Implement auto-execution logic
3. Add risk management
4. Test on small amounts first!

### Customize Configuration
Adjust `.env` parameters based on:
- Your risk tolerance
- Market conditions
- Time availability
- Profit targets

## 10. Safety Reminder

⚠️ **Important**: This bot is for monitoring and notifications only. Always verify opportunities manually before trading. Cryptocurrency trading carries significant risk.

---

Happy arbitrage hunting! 🚀💰

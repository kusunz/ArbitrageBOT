# Crypto Arbitrage Bot

An intelligent cryptocurrency arbitrage bot that uses volume-based scanning to detect profitable trading opportunities across 20+ centralized exchanges and multiple DEX chains.

## Features

- **Smart Volume Scanning**: Monitors top 1300 coins by market cap and identifies volume spikes
- **Hot List Management**: Dynamically tracks 20-50 coins showing high trading activity
- **Multi-Exchange Support**: Scans 20 major CEXs (Binance, Bybit, OKX, Gate.io, etc.)
- **DEX Integration**: Monitors low-gas chains (BSC, Polygon, Arbitrum, Optimism, Base, etc.)
- **Comprehensive Fee Calculation**: Accounts for trading fees, withdrawal fees, and gas costs
- **Simple & Triangular Arbitrage**: Detects both simple (A→B) and triangular (A→B→C→A) opportunities
- **Real-time Notifications**: Telegram alerts + console logging
- **Historical Learning**: Tracks coins that frequently have arbitrage opportunities
- **Efficient Caching**: Minimizes API calls to stay within free tier limits

## Architecture

```
ArbitrageBOT/
├── src/
│   ├── config/
│   │   └── config.ts              # Configuration settings
│   ├── exchanges/
│   │   ├── cex.service.ts         # CEX connector using CCXT
│   │   └── dex.service.ts         # DEX price aggregator
│   ├── services/
│   │   ├── coinlist.service.ts    # Fetch top 1300 coins
│   │   ├── volume-scanner.service.ts  # Volume spike detection
│   │   ├── hotlist.service.ts     # Dynamic hot list management
│   │   ├── arbitrage.service.ts   # Simple arbitrage detection
│   │   ├── triangular.service.ts  # Triangular arbitrage
│   │   └── notification.service.ts # Telegram notifications
│   ├── utils/
│   │   ├── cache.ts               # In-memory caching
│   │   └── logger.ts              # Logging utility
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   └── index.ts                   # Main entry point
├── .env                           # Environment variables
└── package.json
```

## Installation

1. **Clone the repository**
```bash
cd g:/tool/ArbitrageBOT
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` file:
```env
# Telegram Bot Configuration (Optional but recommended)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Arbitrage Settings
ARBITRAGE_THRESHOLD=3
VOLUME_SPIKE_THRESHOLD=3
MIN_ABSOLUTE_VOLUME=500000
HOT_LIST_SIZE=50
SCAN_INTERVAL=300000
```

4. **Build the project**
```bash
npm run build
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## How It Works

### 1. Volume-Based Scanning Strategy

Instead of scanning all 1300 coins continuously, the bot uses a smart approach:

**Every 5 minutes:**
- Scans top 200 coins for volume activity
- Identifies volume spikes (3x+ normal volume)
- Detects high absolute volume (>$500k)
- Finds cross-exchange volume disparities
- Updates the "Hot List" (20-50 active coins)

**Every 30 seconds:**
- Scans only the Hot List for arbitrage opportunities
- Checks both simple and triangular arbitrage
- Calculates all fees (trading, withdrawal, gas)
- Sends notifications for profitable opportunities (3%+)

### 2. Fee Calculation

The bot considers ALL fees before reporting profit:

- **Trading Fees**: 0.1% average on CEXs, 0.3% on DEXs
- **Withdrawal Fees**: Real-time from exchange APIs
- **Gas Fees**: Estimated per chain (BSC: $0.1, Polygon: $0.05, ETH: $5+)
- **Net Profit** = Gross Profit - All Fees

### 3. Hot List Intelligence

Coins are added to the Hot List based on:
- Volume spikes (3x+ normal)
- High absolute volume (>$500k)
- Cross-exchange disparities
- Historical arbitrage patterns

Coins auto-remove after 30 minutes of inactivity.

### 4. Supported Exchanges

**CEXs (20):**
Binance, Bybit, OKX, Gate.io, KuCoin, HTX, Crypto.com, BingX, Kraken, Bitget, MEXC, Bitfinex, Coinbase, Gemini, Bitstamp, Phemex, BitMart, LBank, AscendEX, Poloniex

**DEX Chains (8):**
BSC, Polygon, Arbitrum, Optimism, Base, Avalanche, Fantom, Ethereum

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ARBITRAGE_THRESHOLD` | 3 | Minimum profit % to trigger notification |
| `VOLUME_SPIKE_THRESHOLD` | 3 | Volume spike multiplier (3x = 3x normal volume) |
| `MIN_ABSOLUTE_VOLUME` | 500000 | Minimum $500k volume to consider |
| `HOT_LIST_SIZE` | 50 | Maximum coins in hot list |
| `SCAN_INTERVAL` | 300000 | Volume scan interval (5 min in ms) |
| `TELEGRAM_BOT_TOKEN` | - | Telegram bot token (optional) |
| `TELEGRAM_CHAT_ID` | - | Telegram chat ID (optional) |

### Setting up Telegram Notifications

1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Get your bot token
3. Start a chat with your bot
4. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
5. Add both to `.env` file

## Example Output

```
[2025-01-04 12:00:00] 🤖 Initializing Arbitrage Bot...
[2025-01-04 12:00:01] ✅ Loaded 1300 coins
[2025-01-04 12:00:02] 🚀 Starting Arbitrage Bot...
[2025-01-04 12:00:03] 📊 Volume scans scheduled every 300 seconds
[2025-01-04 12:00:03] 💰 Arbitrage scans scheduled every 30 seconds
[2025-01-04 12:00:03] 🎯 Bot is now actively monitoring for opportunities!

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

## Performance & Cost Optimization

- **Caching**: Reduces API calls by 90%+
- **Smart Scanning**: Only scans active/volatile coins
- **Rate Limiting**: Stays within free API tiers
- **Batch Processing**: Groups API requests efficiently
- **Free APIs**: CoinGecko, CCXT, 1inch (free tiers)

## Future Extensions (Auto-Trading)

The bot is designed to easily extend to auto-trading:

```typescript
// Future: Auto-execute trades
if (opportunity.netProfitPercentage >= 5) {
  await executeArbitrage(opportunity);
}
```

Just add exchange API keys to `.env` and implement the execution logic.

## Troubleshooting

**No coins loaded:**
- Check internet connection
- CoinGecko API might be rate-limited (wait 1 hour)

**No arbitrage found:**
- Market might be efficient currently
- Lower `ARBITRAGE_THRESHOLD` in `.env` (but expect lower profits)
- Increase `HOT_LIST_SIZE` to scan more coins

**Telegram not working:**
- Verify bot token and chat ID
- Ensure bot is started (send /start to your bot)

## License

MIT

## Disclaimer

This bot is for educational and research purposes. Cryptocurrency trading carries risk. Always verify opportunities manually before trading. The authors are not responsible for any financial losses.

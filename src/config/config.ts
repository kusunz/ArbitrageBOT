import dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

export const config: Config = {
  // Arbitrage settings
  arbitrageThreshold: parseFloat(process.env.ARBITRAGE_THRESHOLD || '3'),

  // Volume scanning settings
  volumeSpikeThreshold: parseFloat(process.env.VOLUME_SPIKE_THRESHOLD || '3'),
  minAbsoluteVolume: parseFloat(process.env.MIN_ABSOLUTE_VOLUME || '500000'),
  hotListSize: parseInt(process.env.HOT_LIST_SIZE || '50'),
  hotListTTL: parseInt(process.env.HOT_LIST_TTL || '1800000'), // 30 minutes
  scanInterval: parseInt(process.env.SCAN_INTERVAL || '300000'), // 5 minutes

  // Telegram configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
};

// Supported CEX exchanges (20 major global exchanges)
export const SUPPORTED_CEX = [
  'binance',
  'bybit',
  'okx',
  'gateio',
  'kucoin',
  'htx',
  'crypto.com',
  'bingx',
  'kraken',
  'bitget',
  'mexc',
  'bitfinex',
  'coinbase',
  'gemini',
  'bitstamp',
  'phemex',
  'bitmart',
  'lbank',
  'ascendex',
  'poloniex',
] as const;

export type SupportedCEX = typeof SUPPORTED_CEX[number];

// Supported DEX chains (low gas fee priority)
export const SUPPORTED_CHAINS = [
  { name: 'BSC', chainId: 56, gasEstimate: 'very_low' },
  { name: 'Polygon', chainId: 137, gasEstimate: 'low' },
  { name: 'Arbitrum', chainId: 42161, gasEstimate: 'low' },
  { name: 'Optimism', chainId: 10, gasEstimate: 'low' },
  { name: 'Base', chainId: 8453, gasEstimate: 'low' },
  { name: 'Avalanche', chainId: 43114, gasEstimate: 'medium' },
  { name: 'Fantom', chainId: 250, gasEstimate: 'low' },
  { name: 'Ethereum', chainId: 1, gasEstimate: 'high' },
] as const;

// Trading pairs to monitor (USDT and USDC pairs)
export const QUOTE_CURRENCIES = ['USDT', 'USDC'] as const;

// Trade size for calculations
export const TRADE_AMOUNT_USD = 100;

// Fee estimates (will be updated with real-time data)
export const DEFAULT_FEES = {
  cexTradingFee: 0.001, // 0.1% average
  dexSwapFee: 0.003,    // 0.3% average
  withdrawalFee: 0,     // Will be fetched per exchange
  gasFee: 0,            // Will be fetched per chain
};

// Cache TTL settings (in milliseconds)
export const CACHE_TTL = {
  coinList: 3600000,        // 1 hour
  exchangeInfo: 3600000,    // 1 hour
  prices: 10000,            // 10 seconds
  volume: 60000,            // 1 minute
  gasFees: 30000,           // 30 seconds
  historicalData: 86400000, // 24 hours
};

// Rate limiting
export const RATE_LIMITS = {
  coingecko: 50,        // calls per minute (free tier)
  exchange: 1200,       // calls per minute (CCXT default)
  oneInch: 100,         // calls per minute
};

// Validation and security checks
if (!config.telegram.botToken || !config.telegram.chatId) {
  console.warn('⚠️  Telegram configuration missing. Notifications will only be logged to console.');
}

// Security: Ensure thresholds are reasonable
if (config.arbitrageThreshold < 0 || config.arbitrageThreshold > 100) {
  console.error('❌ Invalid ARBITRAGE_THRESHOLD. Must be between 0-100.');
  process.exit(1);
}

if (config.volumeSpikeThreshold < 1) {
  console.error('❌ Invalid VOLUME_SPIKE_THRESHOLD. Must be >= 1.');
  process.exit(1);
}

if (config.hotListSize < 1 || config.hotListSize > 500) {
  console.error('❌ Invalid HOT_LIST_SIZE. Must be between 1-500.');
  process.exit(1);
}

// Security: Warn if sensitive data might be exposed
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN.length < 20) {
  console.warn('⚠️  TELEGRAM_BOT_TOKEN seems too short. Please verify.');
}

export default config;

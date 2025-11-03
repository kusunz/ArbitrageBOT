import ccxt from 'ccxt';
import { Price, CEXTicker, ExchangeInfo } from '../types';
import { globalCache } from '../utils/cache';
import { Logger } from '../utils/logger';
import { SUPPORTED_CEX, CACHE_TTL, DEFAULT_FEES } from '../config/config';

/**
 * Centralized Exchange (CEX) service using CCXT
 * Manages connections to 20 major exchanges
 */
export class CEXService {
  private exchanges: Map<string, any> = new Map();
  private exchangeInfo: Map<string, ExchangeInfo> = new Map();

  constructor() {
    this.initializeExchanges();
  }

  /**
   * Initialize all supported exchanges
   */
  private initializeExchanges(): void {
    Logger.info('Initializing CEX exchanges...');

    for (const exchangeId of SUPPORTED_CEX) {
      try {
        const ExchangeClass = (ccxt as any)[exchangeId];

        if (!ExchangeClass) {
          Logger.warn(`Exchange ${exchangeId} not found in CCXT`);
          continue;
        }

        const exchange = new ExchangeClass({
          enableRateLimit: true,
          timeout: 30000,
        });

        this.exchanges.set(exchangeId, exchange);

        // Store basic exchange info
        this.exchangeInfo.set(exchangeId, {
          id: exchangeId,
          name: exchange.name || exchangeId,
          type: 'CEX',
          tradingFee: DEFAULT_FEES.cexTradingFee,
          withdrawalFees: new Map(),
          hasWebSocket: typeof exchange.has?.watchTicker === 'boolean' ? exchange.has.watchTicker : false,
          rateLimit: exchange.rateLimit || 1000,
        });

        Logger.debug(`Initialized ${exchangeId}`);
      } catch (error) {
        Logger.error(`Failed to initialize ${exchangeId}:`, error);
      }
    }

    Logger.success(`Initialized ${this.exchanges.size} CEX exchanges`);
  }

  /**
   * Fetch ticker for a specific symbol from an exchange
   */
  async fetchTicker(exchangeId: string, symbol: string): Promise<CEXTicker | null> {
    const cacheKey = `ticker:${exchangeId}:${symbol}`;
    const cached = globalCache.get<CEXTicker>(cacheKey);

    if (cached) {
      return cached;
    }

    const exchange = this.exchanges.get(exchangeId);
    if (!exchange) {
      Logger.warn(`Exchange ${exchangeId} not available`);
      return null;
    }

    try {
      // Load markets if not already loaded
      if (!exchange.markets) {
        await exchange.loadMarkets();
      }

      const ticker = await exchange.fetchTicker(symbol);

      const cexTicker: CEXTicker = {
        symbol,
        bid: ticker.bid || 0,
        ask: ticker.ask || 0,
        last: ticker.last || 0,
        volume: ticker.quoteVolume || ticker.baseVolume || 0,
        timestamp: Date.now(),
      };

      globalCache.set(cacheKey, cexTicker, CACHE_TTL.prices);
      return cexTicker;
    } catch (error) {
      // Silently fail for individual tickers (symbol might not exist on exchange)
      Logger.debug(`Failed to fetch ${symbol} from ${exchangeId}`);
      return null;
    }
  }

  /**
   * Fetch tickers for multiple symbols from an exchange
   */
  async fetchTickers(exchangeId: string, symbols: string[]): Promise<Map<string, CEXTicker>> {
    const exchange = this.exchanges.get(exchangeId);
    const results = new Map<string, CEXTicker>();

    if (!exchange) {
      Logger.warn(`Exchange ${exchangeId} not available`);
      return results;
    }

    try {
      // Load markets if not already loaded
      if (!exchange.markets) {
        await exchange.loadMarkets();
      }

      // Try to fetch all tickers at once if supported
      if (exchange.has['fetchTickers']) {
        try {
          const tickers = await exchange.fetchTickers(symbols);

          for (const [symbol, ticker] of Object.entries(tickers)) {
            const t = ticker as any;
            const cexTicker: CEXTicker = {
              symbol,
              bid: t.bid || 0,
              ask: t.ask || 0,
              last: t.last || 0,
              volume: t.quoteVolume || t.baseVolume || 0,
              timestamp: Date.now(),
            };

            results.set(symbol, cexTicker);
            globalCache.set(`ticker:${exchangeId}:${symbol}`, cexTicker, CACHE_TTL.prices);
          }

          return results;
        } catch (error) {
          Logger.debug(`Bulk fetch failed for ${exchangeId}, falling back to individual fetches`);
        }
      }

      // Fallback: fetch individually
      for (const symbol of symbols) {
        const ticker = await this.fetchTicker(exchangeId, symbol);
        if (ticker) {
          results.set(symbol, ticker);
        }
      }

      return results;
    } catch (error) {
      Logger.error(`Failed to fetch tickers from ${exchangeId}:`, error);
      return results;
    }
  }

  /**
   * Get price for a symbol across all exchanges
   */
  async getPricesAcrossExchanges(symbol: string): Promise<Price[]> {
    const prices: Price[] = [];
    const promises: Promise<void>[] = [];

    for (const exchangeId of this.exchanges.keys()) {
      promises.push(
        (async () => {
          const ticker = await this.fetchTicker(exchangeId, symbol);
          if (ticker && ticker.last > 0) {
            prices.push({
              exchange: exchangeId,
              symbol,
              price: ticker.last,
              volume24h: ticker.volume,
              timestamp: ticker.timestamp,
              type: 'CEX',
            });
          }
        })()
      );
    }

    await Promise.allSettled(promises);
    return prices;
  }

  /**
   * Get volume data for a symbol across all exchanges
   */
  async getVolumeData(symbol: string): Promise<Map<string, number>> {
    const volumeData = new Map<string, number>();

    for (const exchangeId of this.exchanges.keys()) {
      const ticker = await this.fetchTicker(exchangeId, symbol);
      if (ticker) {
        volumeData.set(exchangeId, ticker.volume);
      }
    }

    return volumeData;
  }

  /**
   * Get withdrawal fee for a currency on an exchange
   */
  async getWithdrawalFee(exchangeId: string, currency: string): Promise<number> {
    const exchange = this.exchanges.get(exchangeId);
    if (!exchange) return 0;

    try {
      if (!exchange.fees) {
        await exchange.loadMarkets();
      }

      const fee = exchange.fees?.funding?.withdraw?.[currency];
      return typeof fee === 'number' ? fee : 0;
    } catch (error) {
      Logger.debug(`Failed to get withdrawal fee for ${currency} on ${exchangeId}`);
      return 0;
    }
  }

  /**
   * Get trading fee for an exchange
   */
  getTradingFee(exchangeId: string): number {
    return this.exchangeInfo.get(exchangeId)?.tradingFee || DEFAULT_FEES.cexTradingFee;
  }

  /**
   * Get list of available exchanges
   */
  getAvailableExchanges(): string[] {
    return Array.from(this.exchanges.keys());
  }

  /**
   * Get exchange info
   */
  getExchangeInfo(exchangeId: string): ExchangeInfo | undefined {
    return this.exchangeInfo.get(exchangeId);
  }

  /**
   * Check if symbol is available on exchange
   */
  async isSymbolAvailable(exchangeId: string, symbol: string): Promise<boolean> {
    const exchange = this.exchanges.get(exchangeId);
    if (!exchange) return false;

    try {
      if (!exchange.markets) {
        await exchange.loadMarkets();
      }
      return symbol in exchange.markets;
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
export const cexService = new CEXService();

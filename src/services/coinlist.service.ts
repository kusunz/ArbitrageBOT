import axios from 'axios';
import { Coin } from '../types';
import { globalCache } from '../utils/cache';
import { Logger } from '../utils/logger';
import { CACHE_TTL, QUOTE_CURRENCIES } from '../config/config';

/**
 * Service to fetch and manage the list of top coins by market cap
 * Uses CoinGecko free API
 */
export class CoinListService {
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
  private readonly TOP_N_COINS = 1300;
  private coins: Coin[] = [];

  /**
   * Fetch top 1300 coins by market cap from CoinGecko
   */
  async fetchTopCoins(): Promise<Coin[]> {
    const cacheKey = 'coinlist:top_coins';
    const cached = globalCache.get<Coin[]>(cacheKey);

    if (cached) {
      Logger.debug('Using cached coin list');
      this.coins = cached;
      return cached;
    }

    try {
      Logger.info(`Fetching top ${this.TOP_N_COINS} coins from CoinGecko...`);

      const coins: Coin[] = [];
      const perPage = 250; // CoinGecko max per page
      const pages = Math.ceil(this.TOP_N_COINS / perPage);

      for (let page = 1; page <= pages; page++) {
        const response = await axios.get(`${this.COINGECKO_API}/coins/markets`, {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: perPage,
            page,
            sparkline: false,
          },
        });

        const pageCoins: Coin[] = response.data.map((coin: any, index: number) => ({
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          marketCap: coin.market_cap,
          rank: (page - 1) * perPage + index + 1,
        }));

        coins.push(...pageCoins);

        // Rate limiting: wait 1.5 seconds between requests (40 calls/min limit)
        if (page < pages) {
          await this.sleep(1500);
        }
      }

      this.coins = coins.slice(0, this.TOP_N_COINS);
      globalCache.set(cacheKey, this.coins, CACHE_TTL.coinList);

      Logger.success(`Fetched ${this.coins.length} coins successfully`);
      return this.coins;
    } catch (error) {
      Logger.error('Failed to fetch coin list from CoinGecko:', error);
      throw error;
    }
  }

  /**
   * Get trading pairs for a coin (symbol/USDT, symbol/USDC)
   */
  getTradingPairs(symbol: string): string[] {
    return QUOTE_CURRENCIES.map(quote => `${symbol}/${quote}`);
  }

  /**
   * Get all trading pairs for top coins
   */
  getAllTradingPairs(): string[] {
    const pairs: string[] = [];

    for (const coin of this.coins) {
      pairs.push(...this.getTradingPairs(coin.symbol));
    }

    return pairs;
  }

  /**
   * Get coin by symbol
   */
  getCoinBySymbol(symbol: string): Coin | undefined {
    return this.coins.find(c => c.symbol === symbol.toUpperCase());
  }

  /**
   * Get current coin list
   */
  getCoins(): Coin[] {
    return this.coins;
  }

  /**
   * Get coin symbols only
   */
  getCoinSymbols(): string[] {
    return this.coins.map(c => c.symbol);
  }

  /**
   * Filter coins by minimum market cap
   */
  filterByMarketCap(minMarketCap: number): Coin[] {
    return this.coins.filter(c => c.marketCap >= minMarketCap);
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const coinListService = new CoinListService();

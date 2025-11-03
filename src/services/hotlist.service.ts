import { HotCoin, VolumeData, HistoricalArbitrage } from '../types';
import { Logger } from '../utils/logger';
import { config } from '../config/config';

/**
 * Hot List Management Service
 * Maintains a dynamic list of coins that are likely to have arbitrage opportunities
 */
export class HotListService {
  private hotList: Map<string, HotCoin> = new Map();
  private historicalArbitrage: Map<string, HistoricalArbitrage> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired hot coins every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCoins();
    }, 60000);
  }

  /**
   * Add coin to hot list
   */
  addToHotList(
    symbol: string,
    reason: 'volume_spike' | 'high_volume' | 'cross_exchange_disparity' | 'historical_pattern',
    volumeData: VolumeData
  ): void {
    // Check if already in hot list
    if (this.hotList.has(symbol)) {
      Logger.debug(`${symbol} already in hot list`);
      return;
    }

    // Check if hot list is full
    if (this.hotList.size >= config.hotListSize) {
      Logger.warn(`Hot list is full (${config.hotListSize} coins). Removing oldest entry.`);
      this.removeOldestCoin();
    }

    const hotCoin: HotCoin = {
      symbol,
      addedAt: Date.now(),
      reason,
      volumeData,
    };

    this.hotList.set(symbol, hotCoin);
    Logger.success(`🔥 Added ${symbol} to hot list (${reason}) - ${this.hotList.size}/${config.hotListSize}`);
  }

  /**
   * Remove coin from hot list
   */
  removeFromHotList(symbol: string): boolean {
    const removed = this.hotList.delete(symbol);
    if (removed) {
      Logger.info(`❄️  Removed ${symbol} from hot list - ${this.hotList.size}/${config.hotListSize}`);
    }
    return removed;
  }

  /**
   * Get all hot coins
   */
  getHotCoins(): HotCoin[] {
    return Array.from(this.hotList.values());
  }

  /**
   * Get hot coin symbols only
   */
  getHotSymbols(): string[] {
    return Array.from(this.hotList.keys());
  }

  /**
   * Check if coin is in hot list
   */
  isHot(symbol: string): boolean {
    return this.hotList.has(symbol);
  }

  /**
   * Get hot list size
   */
  getSize(): number {
    return this.hotList.size;
  }

  /**
   * Update volume data for a hot coin
   */
  updateVolumeData(symbol: string, volumeData: VolumeData): void {
    const hotCoin = this.hotList.get(symbol);
    if (hotCoin) {
      hotCoin.volumeData = volumeData;
    }
  }

  /**
   * Clean up coins that have been in the hot list too long
   */
  private cleanupExpiredCoins(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [symbol, hotCoin] of this.hotList.entries()) {
      if (now - hotCoin.addedAt > config.hotListTTL) {
        expired.push(symbol);
      }
    }

    if (expired.length > 0) {
      Logger.info(`Cleaning up ${expired.length} expired coins from hot list`);
      expired.forEach(symbol => this.removeFromHotList(symbol));
    }
  }

  /**
   * Remove oldest coin from hot list
   */
  private removeOldestCoin(): void {
    let oldestSymbol: string | null = null;
    let oldestTime = Date.now();

    for (const [symbol, hotCoin] of this.hotList.entries()) {
      if (hotCoin.addedAt < oldestTime) {
        oldestTime = hotCoin.addedAt;
        oldestSymbol = symbol;
      }
    }

    if (oldestSymbol) {
      this.removeFromHotList(oldestSymbol);
    }
  }

  /**
   * Record arbitrage opportunity for historical tracking
   */
  recordArbitrage(symbol: string, profit: number): void {
    const historical = this.historicalArbitrage.get(symbol) || {
      symbol,
      occurrences: 0,
      lastSeen: 0,
      averageProfit: 0,
    };

    // Update statistics
    const totalProfit = historical.averageProfit * historical.occurrences + profit;
    historical.occurrences += 1;
    historical.averageProfit = totalProfit / historical.occurrences;
    historical.lastSeen = Date.now();

    this.historicalArbitrage.set(symbol, historical);

    Logger.debug(`Recorded arbitrage for ${symbol}: ${historical.occurrences} total occurrences`);
  }

  /**
   * Get historically profitable coins (frequently have arbitrage)
   */
  getHistoricallyProfitable(minOccurrences: number = 3): string[] {
    const profitable: string[] = [];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const [symbol, data] of this.historicalArbitrage.entries()) {
      if (data.occurrences >= minOccurrences && data.lastSeen > weekAgo) {
        profitable.push(symbol);
      }
    }

    return profitable;
  }

  /**
   * Add historically profitable coins to hot list
   */
  addHistoricalCoins(): void {
    const historicalSymbols = this.getHistoricallyProfitable();

    for (const symbol of historicalSymbols) {
      if (!this.isHot(symbol) && this.hotList.size < config.hotListSize) {
        const historical = this.historicalArbitrage.get(symbol)!;
        this.addToHotList(
          symbol,
          'historical_pattern',
          {
            symbol,
            currentVolume: 0,
            averageVolume: 0,
            volumeSpike: 1,
            timestamp: Date.now(),
          }
        );

        Logger.info(
          `Added ${symbol} based on historical pattern (${historical.occurrences} past opportunities, avg ${historical.averageProfit.toFixed(2)}%)`
        );
      }
    }
  }

  /**
   * Get hot list statistics
   */
  getStats() {
    const reasonCount = new Map<string, number>();

    for (const hotCoin of this.hotList.values()) {
      const count = reasonCount.get(hotCoin.reason) || 0;
      reasonCount.set(hotCoin.reason, count + 1);
    }

    return {
      totalHotCoins: this.hotList.size,
      maxSize: config.hotListSize,
      byReason: Object.fromEntries(reasonCount),
      historicalCoins: this.historicalArbitrage.size,
    };
  }

  /**
   * Clear hot list
   */
  clear(): void {
    this.hotList.clear();
    Logger.info('Hot list cleared');
  }

  /**
   * Destroy service
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.hotList.clear();
  }
}

// Singleton instance
export const hotListService = new HotListService();

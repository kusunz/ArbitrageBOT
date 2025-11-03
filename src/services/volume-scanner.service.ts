import { VolumeData } from '../types';
import { cexService } from '../exchanges/cex.service';
import { coinListService } from './coinlist.service';
import { globalCache } from '../utils/cache';
import { Logger } from '../utils/logger';
import { config, CACHE_TTL } from '../config/config';

/**
 * Volume Scanner Service
 * Detects volume spikes and high-volume trading activity
 */
export class VolumeScannerService {
  private volumeHistory: Map<string, number[]> = new Map();
  private readonly HISTORY_WINDOW = 12; // Keep 12 data points (1 hour if scanning every 5 min)

  /**
   * Scan all coins for volume activity
   */
  async scanVolumes(): Promise<VolumeData[]> {
    Logger.volume('Starting volume scan...');

    const coins = coinListService.getCoins();
    if (coins.length === 0) {
      Logger.warn('No coins loaded. Fetching coin list...');
      await coinListService.fetchTopCoins();
      return [];
    }

    const volumeData: VolumeData[] = [];
    const symbols = coins.slice(0, 200).map(c => c.symbol); // Scan top 200 for efficiency

    // Process in batches to avoid rate limits
    const batchSize = 20;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchResults = await this.scanBatch(batch);
      volumeData.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await this.sleep(2000);
      }
    }

    Logger.success(`Volume scan complete. Found ${volumeData.length} coins with data.`);
    return volumeData;
  }

  /**
   * Scan a batch of symbols
   */
  private async scanBatch(symbols: string[]): Promise<VolumeData[]> {
    const results: VolumeData[] = [];

    for (const symbol of symbols) {
      try {
        const volumeData = await this.getVolumeDataForSymbol(symbol);
        if (volumeData) {
          results.push(volumeData);
        }
      } catch (error) {
        Logger.debug(`Failed to get volume for ${symbol}`);
      }
    }

    return results;
  }

  /**
   * Get volume data for a specific symbol
   */
  private async getVolumeDataForSymbol(symbol: string): Promise<VolumeData | null> {
    const tradingPair = `${symbol}/USDT`;

    // Get volume from multiple exchanges
    const volumePromises = cexService
      .getAvailableExchanges()
      .slice(0, 5) // Check top 5 exchanges only
      .map(async exchange => {
        const ticker = await cexService.fetchTicker(exchange, tradingPair);
        return ticker?.volume || 0;
      });

    const volumes = await Promise.all(volumePromises);
    const currentVolume = volumes.reduce((sum, v) => sum + v, 0);

    if (currentVolume === 0) {
      return null;
    }

    // Update history
    const history = this.volumeHistory.get(symbol) || [];
    history.push(currentVolume);

    // Keep only recent history
    if (history.length > this.HISTORY_WINDOW) {
      history.shift();
    }
    this.volumeHistory.set(symbol, history);

    // Calculate average volume
    const averageVolume = history.length > 0
      ? history.reduce((sum, v) => sum + v, 0) / history.length
      : currentVolume;

    // Calculate volume spike
    const volumeSpike = averageVolume > 0 ? currentVolume / averageVolume : 1;

    return {
      symbol,
      currentVolume,
      averageVolume,
      volumeSpike,
      timestamp: Date.now(),
    };
  }

  /**
   * Identify coins with volume spikes
   */
  identifyVolumeSpikes(volumeData: VolumeData[]): VolumeData[] {
    return volumeData.filter(data => {
      const hasSpike = data.volumeSpike >= config.volumeSpikeThreshold;
      const meetsMinVolume = data.currentVolume >= config.minAbsoluteVolume;

      if (hasSpike && meetsMinVolume) {
        Logger.volume(
          `📈 Volume spike detected: ${data.symbol} - ${data.volumeSpike.toFixed(2)}x (${this.formatVolume(data.currentVolume)})`
        );
        return true;
      }

      return false;
    });
  }

  /**
   * Identify coins with high absolute volume
   */
  identifyHighVolume(volumeData: VolumeData[]): VolumeData[] {
    return volumeData.filter(data => {
      const hasHighVolume = data.currentVolume >= config.minAbsoluteVolume * 2;

      if (hasHighVolume) {
        Logger.volume(
          `💵 High volume detected: ${data.symbol} - ${this.formatVolume(data.currentVolume)}`
        );
        return true;
      }

      return false;
    });
  }

  /**
   * Identify cross-exchange volume disparities
   */
  async identifyCrossExchangeDisparities(symbols: string[]): Promise<Map<string, number>> {
    const disparities = new Map<string, number>();

    for (const symbol of symbols) {
      try {
        const tradingPair = `${symbol}/USDT`;
        const volumeMap = await cexService.getVolumeData(tradingPair);

        if (volumeMap.size < 2) continue;

        const volumes = Array.from(volumeMap.values());
        const maxVolume = Math.max(...volumes);
        const minVolume = Math.min(...volumes.filter(v => v > 0));

        if (minVolume > 0) {
          const disparity = maxVolume / minVolume;
          if (disparity >= 3) {
            // 3x disparity between exchanges
            disparities.set(symbol, disparity);
            Logger.volume(
              `🔄 Cross-exchange disparity: ${symbol} - ${disparity.toFixed(2)}x difference`
            );
          }
        }
      } catch (error) {
        Logger.debug(`Failed to check disparity for ${symbol}`);
      }
    }

    return disparities;
  }

  /**
   * Format volume for display
   */
  private formatVolume(volume: number): string {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
  }

  /**
   * Clear volume history
   */
  clearHistory(): void {
    this.volumeHistory.clear();
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const volumeScannerService = new VolumeScannerService();

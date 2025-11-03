import { config } from './config/config';
import { Logger } from './utils/logger';
import { coinListService } from './services/coinlist.service';
import { volumeScannerService } from './services/volume-scanner.service';
import { hotListService } from './services/hotlist.service';
import { arbitrageService } from './services/arbitrage.service';
import { triangularArbitrageService } from './services/triangular.service';
import { notificationService } from './services/notification.service';

/**
 * Main Arbitrage Bot Application
 */
class ArbitrageBot {
  private isRunning: boolean = false;
  private scanIntervalId: NodeJS.Timeout | null = null;
  private arbitrageIntervalId: NodeJS.Timeout | null = null;

  /**
   * Initialize the bot
   */
  async initialize(): Promise<void> {
    Logger.info('🤖 Initializing Arbitrage Bot...');
    Logger.info('='.repeat(60));

    // Display configuration
    this.displayConfig();

    // Send startup notification
    await notificationService.testNotification();

    // Fetch initial coin list
    try {
      await coinListService.fetchTopCoins();
      Logger.success(`Loaded ${coinListService.getCoins().length} coins`);
    } catch (error) {
      Logger.error('Failed to fetch coin list. Bot will retry...', error);
    }

    Logger.info('='.repeat(60));
    Logger.success('✅ Bot initialized successfully!');
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('Bot is already running');
      return;
    }

    this.isRunning = true;
    Logger.success('🚀 Starting Arbitrage Bot...');

    // Initial scan
    await this.performVolumeScan();

    // Schedule volume scans
    this.scanIntervalId = setInterval(async () => {
      await this.performVolumeScan();
    }, config.scanInterval);

    Logger.info(`📊 Volume scans scheduled every ${config.scanInterval / 1000} seconds`);

    // Schedule arbitrage scans (more frequent - every 30 seconds)
    this.arbitrageIntervalId = setInterval(async () => {
      await this.performArbitrageScan();
    }, 30000);

    Logger.info('💰 Arbitrage scans scheduled every 30 seconds');
    Logger.info('='.repeat(60));
    Logger.success('🎯 Bot is now actively monitoring for opportunities!');
  }

  /**
   * Perform volume scan
   */
  private async performVolumeScan(): Promise<void> {
    try {
      Logger.volume('📊 Starting volume scan cycle...');

      // Scan volumes
      const volumeData = await volumeScannerService.scanVolumes();

      if (volumeData.length === 0) {
        Logger.warn('No volume data received');
        return;
      }

      // Identify volume spikes
      const volumeSpikes = volumeScannerService.identifyVolumeSpikes(volumeData);
      for (const spike of volumeSpikes) {
        hotListService.addToHotList(spike.symbol, 'volume_spike', spike);
        await notificationService.sendVolumeAlert(
          spike.symbol,
          spike.volumeSpike,
          spike.currentVolume
        );
      }

      // Identify high volume coins
      const highVolume = volumeScannerService.identifyHighVolume(volumeData);
      for (const coin of highVolume) {
        if (!hotListService.isHot(coin.symbol)) {
          hotListService.addToHotList(coin.symbol, 'high_volume', coin);
        }
      }

      // Check cross-exchange disparities
      const hotSymbols = hotListService.getHotSymbols();
      if (hotSymbols.length > 0) {
        const disparities = await volumeScannerService.identifyCrossExchangeDisparities(
          hotSymbols.slice(0, 20)
        );

        for (const [symbol, disparity] of disparities) {
          const coinVolumeData = volumeData.find((v: { symbol: string }) => v.symbol === symbol);
          if (coinVolumeData) {
            hotListService.addToHotList(symbol, 'cross_exchange_disparity', coinVolumeData);
          }
        }
      }

      // Add historical profitable coins
      hotListService.addHistoricalCoins();

      // Display stats
      const stats = hotListService.getStats();
      Logger.volume(
        `Hot List: ${stats.totalHotCoins}/${stats.maxSize} | ` +
        `Spikes: ${stats.byReason.volume_spike || 0} | ` +
        `High Vol: ${stats.byReason.high_volume || 0} | ` +
        `Disparity: ${stats.byReason.cross_exchange_disparity || 0} | ` +
        `Historical: ${stats.byReason.historical_pattern || 0}`
      );
    } catch (error) {
      Logger.error('Volume scan failed:', error);
    }
  }

  /**
   * Perform arbitrage scan
   */
  private async performArbitrageScan(): Promise<void> {
    try {
      const hotSymbols = hotListService.getHotSymbols();

      if (hotSymbols.length === 0) {
        Logger.debug('No hot coins to scan for arbitrage');
        return;
      }

      Logger.arbitrage(`💰 Scanning ${hotSymbols.length} hot coins for arbitrage...`);

      // Simple arbitrage
      const simpleOpportunities = await arbitrageService.scanArbitrageOpportunities();

      // Triangular arbitrage (on top hot coins only)
      const topHotSymbols = hotSymbols.slice(0, 5);
      const triangularOpportunities = await triangularArbitrageService.scanAllExchanges(
        topHotSymbols
      );

      const totalOpportunities = simpleOpportunities.length + triangularOpportunities.length;

      if (totalOpportunities > 0) {
        Logger.success(
          `✅ Found ${totalOpportunities} opportunities (${simpleOpportunities.length} simple, ${triangularOpportunities.length} triangular)`
        );

        // Notify about triangular opportunities
        for (const opportunity of triangularOpportunities) {
          if (opportunity.netProfitPercentage >= config.arbitrageThreshold) {
            await notificationService.sendArbitrageAlert(opportunity);
            hotListService.recordArbitrage(opportunity.symbol, opportunity.netProfitPercentage);
          }
        }
      } else {
        Logger.debug('No profitable arbitrage opportunities found');
      }
    } catch (error) {
      Logger.error('Arbitrage scan failed:', error);
    }
  }

  /**
   * Stop the bot
   */
  stop(): void {
    if (!this.isRunning) {
      Logger.warn('Bot is not running');
      return;
    }

    Logger.info('Stopping Arbitrage Bot...');

    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
    }

    if (this.arbitrageIntervalId) {
      clearInterval(this.arbitrageIntervalId);
      this.arbitrageIntervalId = null;
    }

    this.isRunning = false;
    Logger.success('✅ Bot stopped successfully');
  }

  /**
   * Display configuration
   */
  private displayConfig(): void {
    Logger.info('Configuration:');
    Logger.info(`  • Arbitrage Threshold: ${config.arbitrageThreshold}%`);
    Logger.info(`  • Volume Spike Threshold: ${config.volumeSpikeThreshold}x`);
    Logger.info(`  • Min Volume: $${config.minAbsoluteVolume.toLocaleString()}`);
    Logger.info(`  • Hot List Size: ${config.hotListSize} coins`);
    Logger.info(`  • Hot List TTL: ${config.hotListTTL / 1000 / 60} minutes`);
    Logger.info(`  • Scan Interval: ${config.scanInterval / 1000} seconds`);
    Logger.info(
      `  • Telegram: ${config.telegram.botToken ? '✅ Configured' : '❌ Not configured'}`
    );
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hotCoins: hotListService.getSize(),
      totalCoins: coinListService.getCoins().length,
    };
  }
}

/**
 * Main execution
 */
async function main() {
  const bot = new ArbitrageBot();

  try {
    // Initialize
    await bot.initialize();

    // Start
    await bot.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      Logger.info('\n📴 Received SIGINT signal');
      bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      Logger.info('\n📴 Received SIGTERM signal');
      bot.stop();
      process.exit(0);
    });
  } catch (error) {
    Logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the bot
if (require.main === module) {
  main().catch(error => {
    Logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { ArbitrageBot };

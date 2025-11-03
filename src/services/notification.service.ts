import TelegramBot from 'node-telegram-bot-api';
import { NotificationMessage, ArbitrageOpportunity } from '../types';
import { config } from '../config/config';
import { Logger } from '../utils/logger';

/**
 * Notification service for sending alerts via Telegram and Console
 */
export class NotificationService {
  private bot: TelegramBot | null = null;
  private enabled: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (config.telegram.botToken && config.telegram.chatId) {
      try {
        this.bot = new TelegramBot(config.telegram.botToken, { polling: false });
        this.enabled = true;
        Logger.success('Telegram bot initialized successfully');
      } catch (error) {
        Logger.error('Failed to initialize Telegram bot:', error);
        this.enabled = false;
      }
    } else {
      Logger.warn('Telegram not configured. Notifications will be console-only.');
      this.enabled = false;
    }
  }

  /**
   * Send arbitrage opportunity notification
   */
  async sendArbitrageAlert(opportunity: ArbitrageOpportunity): Promise<void> {
    const message = this.formatArbitrageMessage(opportunity);
    await this.send({
      title: '💰 ARBITRAGE OPPORTUNITY',
      message,
      opportunity,
      urgency: this.getUrgency(opportunity.netProfitPercentage),
    });
  }

  /**
   * Send volume spike notification
   */
  async sendVolumeAlert(symbol: string, volumeSpike: number, currentVolume: number): Promise<void> {
    const message = `
📊 Volume Spike Detected!
Symbol: ${symbol}
Volume Spike: ${volumeSpike.toFixed(2)}x normal
Current Volume: $${this.formatNumber(currentVolume)}
    `.trim();

    await this.send({
      title: '📊 VOLUME SPIKE',
      message,
      urgency: 'medium',
    });
  }

  /**
   * Send general notification
   */
  async send(notification: NotificationMessage): Promise<void> {
    const fullMessage = `${notification.title}\n\n${notification.message}`;

    // Always log to console
    this.logToConsole(notification);

    // Send to Telegram if enabled
    if (this.enabled && this.bot) {
      try {
        await this.bot.sendMessage(config.telegram.chatId, fullMessage, {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        });
      } catch (error) {
        Logger.error('Failed to send Telegram message:', error);
      }
    }
  }

  /**
   * Format arbitrage opportunity as readable message
   */
  private formatArbitrageMessage(opp: ArbitrageOpportunity): string {
    const emoji = opp.type === 'triangular' ? '🔺' : '💱';

    let message = `
${emoji} Type: ${opp.type.toUpperCase()}
Symbol: ${opp.symbol}

📍 Buy: ${opp.buyExchange} @ $${opp.buyPrice.toFixed(6)}
📍 Sell: ${opp.sellExchange} @ $${opp.sellPrice.toFixed(6)}

💵 Price Difference: ${opp.percentageDifference.toFixed(2)}%
💰 Estimated Profit: $${opp.estimatedProfit.toFixed(2)}

📊 Fee Breakdown:
  • Trading Fees: $${(opp.fees.buyTradingFee + opp.fees.sellTradingFee).toFixed(2)}
  • Withdrawal Fee: $${opp.fees.withdrawalFee.toFixed(2)}
  • Gas Fee: $${opp.fees.gasFee.toFixed(2)}
  • Total Fees: $${opp.fees.totalFees.toFixed(2)}

✅ NET PROFIT: $${opp.netProfit.toFixed(2)} (${opp.netProfitPercentage.toFixed(2)}%)
💼 Trade Amount: $${opp.tradeAmount}
    `.trim();

    if (opp.path && opp.type === 'triangular') {
      message += `\n\n🔺 Path: ${opp.path.join(' → ')}`;
    }

    return message;
  }

  /**
   * Determine urgency based on profit percentage
   */
  private getUrgency(profitPercentage: number): 'low' | 'medium' | 'high' {
    if (profitPercentage >= 5) return 'high';
    if (profitPercentage >= 3) return 'medium';
    return 'low';
  }

  /**
   * Log notification to console with appropriate formatting
   */
  private logToConsole(notification: NotificationMessage): void {
    const border = '='.repeat(60);
    console.log('\n' + border);

    switch (notification.urgency) {
      case 'high':
        Logger.arbitrage(`🚨 ${notification.title}`);
        break;
      case 'medium':
        Logger.arbitrage(notification.title);
        break;
      default:
        Logger.info(notification.title);
    }

    console.log(notification.message);
    console.log(border + '\n');
  }

  /**
   * Format large numbers with commas
   */
  private formatNumber(num: number): string {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /**
   * Test notification
   */
  async testNotification(): Promise<void> {
    await this.send({
      title: '🤖 Bot Started',
      message: 'Arbitrage bot is now running and monitoring opportunities!',
      urgency: 'low',
    });
  }
}

// Singleton instance
export const notificationService = new NotificationService();

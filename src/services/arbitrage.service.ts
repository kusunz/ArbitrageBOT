import { ArbitrageOpportunity, Price, FeeBreakdown } from '../types';
import { cexService } from '../exchanges/cex.service';
import { dexService } from '../exchanges/dex.service';
import { hotListService } from './hotlist.service';
import { notificationService } from './notification.service';
import { exchangeStatusService } from './exchange-status.service';
import { Logger } from '../utils/logger';
import { config, TRADE_AMOUNT_USD, DEFAULT_FEES } from '../config/config';

/**
 * Arbitrage Detection and Calculation Service
 * Finds arbitrage opportunities with comprehensive fee consideration
 */
export class ArbitrageService {
  /**
   * Scan for arbitrage opportunities on hot coins
   */
  async scanArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const hotSymbols = hotListService.getHotSymbols();

    if (hotSymbols.length === 0) {
      Logger.debug('No hot coins to scan for arbitrage');
      return [];
    }

    Logger.info(`🔍 Scanning ${hotSymbols.length} hot coins for arbitrage...`);

    const opportunities: ArbitrageOpportunity[] = [];

    for (const symbol of hotSymbols) {
      try {
        const symbolOpportunities = await this.findArbitrageForSymbol(symbol);
        opportunities.push(...symbolOpportunities);
      } catch (error) {
        Logger.debug(`Failed to scan arbitrage for ${symbol}`);
      }
    }

    Logger.success(`Found ${opportunities.length} arbitrage opportunities`);

    // Send notifications for profitable opportunities
    for (const opportunity of opportunities) {
      if (opportunity.netProfitPercentage >= config.arbitrageThreshold) {
        await notificationService.sendArbitrageAlert(opportunity);
        hotListService.recordArbitrage(opportunity.symbol, opportunity.netProfitPercentage);
      }
    }

    return opportunities;
  }

  /**
   * Find arbitrage opportunities for a specific symbol
   */
  private async findArbitrageForSymbol(symbol: string): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Get prices from all CEXs
    const tradingPair = `${symbol}/USDT`;
    const prices = await cexService.getPricesAcrossExchanges(tradingPair);

    if (prices.length < 2) {
      return opportunities;
    }

    // Compare all price combinations
    for (let i = 0; i < prices.length; i++) {
      for (let j = i + 1; j < prices.length; j++) {
        const price1 = prices[i];
        const price2 = prices[j];

        // Determine buy and sell exchanges
        let buyExchange: string, sellExchange: string, buyPrice: number, sellPrice: number;

        if (price1.price < price2.price) {
          buyExchange = price1.exchange;
          sellExchange = price2.exchange;
          buyPrice = price1.price;
          sellPrice = price2.price;
        } else {
          buyExchange = price2.exchange;
          sellExchange = price1.exchange;
          buyPrice = price2.price;
          sellPrice = price1.price;
        }

        // Calculate opportunity
        const opportunity = await this.calculateArbitrage(
          symbol,
          buyExchange,
          sellExchange,
          buyPrice,
          sellPrice
        );

        if (opportunity && opportunity.netProfitPercentage >= config.arbitrageThreshold) {
          opportunities.push(opportunity);
        }
      }
    }

    return opportunities;
  }

  /**
   * Calculate arbitrage opportunity with all fees
   */
  private async calculateArbitrage(
    symbol: string,
    buyExchange: string,
    sellExchange: string,
    buyPrice: number,
    sellPrice: number
  ): Promise<ArbitrageOpportunity | null> {
    // Check if token has suspended withdrawal/deposit
    if (exchangeStatusService.shouldSkipArbitrage(buyExchange, sellExchange, symbol)) {
      return null; // Skip this opportunity
    }

    // Price difference
    const priceDifference = sellPrice - buyPrice;
    const percentageDifference = (priceDifference / buyPrice) * 100;

    // Calculate fees
    const fees = await this.calculateFees(symbol, buyExchange, sellExchange, buyPrice);

    // Calculate profits
    const estimatedProfit = (priceDifference / buyPrice) * TRADE_AMOUNT_USD;
    const netProfit = estimatedProfit - fees.totalFees;
    const netProfitPercentage = (netProfit / TRADE_AMOUNT_USD) * 100;

    // Only return if net profit is positive
    if (netProfit <= 0) {
      return null;
    }

    return {
      symbol,
      type: 'simple',
      buyExchange,
      sellExchange,
      buyPrice,
      sellPrice,
      priceDifference,
      percentageDifference,
      estimatedProfit,
      fees,
      netProfit,
      netProfitPercentage,
      timestamp: Date.now(),
      tradeAmount: TRADE_AMOUNT_USD,
    };
  }

  /**
   * Calculate all fees for an arbitrage trade
   */
  private async calculateFees(
    symbol: string,
    buyExchange: string,
    sellExchange: string,
    price: number
  ): Promise<FeeBreakdown> {
    // Trading fees
    const buyTradingFeeRate = cexService.getTradingFee(buyExchange);
    const sellTradingFeeRate = cexService.getTradingFee(sellExchange);

    const buyTradingFee = TRADE_AMOUNT_USD * buyTradingFeeRate;
    const sellTradingFee = TRADE_AMOUNT_USD * sellTradingFeeRate;

    // Withdrawal fee (from buy exchange)
    const baseSymbol = symbol.split('/')[0];
    const withdrawalFeeInCoin = await cexService.getWithdrawalFee(buyExchange, baseSymbol);
    const withdrawalFee = withdrawalFeeInCoin * price;

    // Gas fee (if using DEX, otherwise 0)
    const gasFee = 0; // No gas fee for CEX-to-CEX arbitrage

    const totalFees = buyTradingFee + sellTradingFee + withdrawalFee + gasFee;

    return {
      buyTradingFee,
      sellTradingFee,
      withdrawalFee,
      gasFee,
      totalFees,
    };
  }

  /**
   * Calculate potential profit percentage
   */
  calculatePotentialProfit(buyPrice: number, sellPrice: number, totalFees: number): number {
    const grossProfit = ((sellPrice - buyPrice) / buyPrice) * TRADE_AMOUNT_USD;
    const netProfit = grossProfit - totalFees;
    return (netProfit / TRADE_AMOUNT_USD) * 100;
  }

  /**
   * Check if arbitrage is profitable after all fees
   */
  isProfitable(opportunity: ArbitrageOpportunity): boolean {
    return (
      opportunity.netProfitPercentage >= config.arbitrageThreshold &&
      opportunity.netProfit > 0
    );
  }

  /**
   * Sort opportunities by profitability
   */
  sortByProfit(opportunities: ArbitrageOpportunity[]): ArbitrageOpportunity[] {
    return opportunities.sort((a, b) => b.netProfit - a.netProfit);
  }

  /**
   * Filter opportunities by minimum profit threshold
   */
  filterByThreshold(
    opportunities: ArbitrageOpportunity[],
    threshold: number = config.arbitrageThreshold
  ): ArbitrageOpportunity[] {
    return opportunities.filter(opp => opp.netProfitPercentage >= threshold);
  }

  /**
   * Get best opportunity for a symbol
   */
  getBestOpportunity(opportunities: ArbitrageOpportunity[]): ArbitrageOpportunity | null {
    if (opportunities.length === 0) return null;

    return this.sortByProfit(opportunities)[0];
  }
}

// Singleton instance
export const arbitrageService = new ArbitrageService();

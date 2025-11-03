import { ArbitrageOpportunity, TriangularPath, FeeBreakdown } from '../types';
import { cexService } from '../exchanges/cex.service';
import { Logger } from '../utils/logger';
import { config, TRADE_AMOUNT_USD } from '../config/config';

/**
 * Triangular Arbitrage Service
 * Detects profitable triangular arbitrage paths (A → B → C → A)
 */
export class TriangularArbitrageService {
  private readonly commonBases = ['BTC', 'ETH', 'BNB', 'USDT', 'USDC'];

  /**
   * Find triangular arbitrage opportunities on a specific exchange
   */
  async findTriangularArbitrage(exchangeId: string, symbols: string[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    Logger.debug(`Scanning triangular arbitrage on ${exchangeId}...`);

    // For each hot coin, try to find triangular paths
    for (const symbol of symbols.slice(0, 10)) {
      // Limit to top 10 for efficiency
      try {
        const paths = await this.findPaths(exchangeId, symbol);

        for (const path of paths) {
          if (path.netProfit > 0 && (path.netProfit / TRADE_AMOUNT_USD) * 100 >= config.arbitrageThreshold) {
            const opportunity = this.convertPathToOpportunity(exchangeId, path);
            opportunities.push(opportunity);
          }
        }
      } catch (error) {
        Logger.debug(`Failed to find triangular path for ${symbol} on ${exchangeId}`);
      }
    }

    return opportunities;
  }

  /**
   * Find possible triangular paths for a symbol
   * Example: COIN/USDT → COIN/BTC → BTC/USDT → back to USDT
   */
  private async findPaths(exchangeId: string, symbol: string): Promise<TriangularPath[]> {
    const paths: TriangularPath[] = [];

    // Try different intermediate currencies
    for (const intermediate of this.commonBases) {
      if (intermediate === 'USDT' || intermediate === 'USDC') continue;

      try {
        // Path: USDT → COIN → INTERMEDIATE → USDT
        // Step 1: Buy COIN with USDT
        const pair1 = `${symbol}/USDT`;
        const ticker1 = await cexService.fetchTicker(exchangeId, pair1);
        if (!ticker1 || ticker1.ask === 0) continue;

        // Step 2: Sell COIN for INTERMEDIATE
        const pair2 = `${symbol}/${intermediate}`;
        const ticker2 = await cexService.fetchTicker(exchangeId, pair2);
        if (!ticker2 || ticker2.bid === 0) continue;

        // Step 3: Sell INTERMEDIATE for USDT
        const pair3 = `${intermediate}/USDT`;
        const ticker3 = await cexService.fetchTicker(exchangeId, pair3);
        if (!ticker3 || ticker3.bid === 0) continue;

        // Calculate the path
        const path = await this.calculateTriangularPath(
          exchangeId,
          [pair1, pair2, pair3],
          [ticker1.ask, ticker2.bid, ticker3.bid]
        );

        if (path) {
          paths.push(path);
        }
      } catch (error) {
        Logger.debug(`Failed to calculate path for ${symbol} via ${intermediate}`);
      }
    }

    return paths;
  }

  /**
   * Calculate profitability of a triangular path
   */
  private async calculateTriangularPath(
    exchangeId: string,
    pairs: string[],
    prices: number[]
  ): Promise<TriangularPath | null> {
    try {
      // Start with $100
      let amount = TRADE_AMOUNT_USD;

      // Step 1: USDT → COIN
      const coinAmount = amount / prices[0]; // How many coins we get
      const fee1 = amount * cexService.getTradingFee(exchangeId);
      amount -= fee1;

      // Step 2: COIN → INTERMEDIATE
      const intermediateAmount = coinAmount * prices[1]; // Value in intermediate currency
      const fee2 = intermediateAmount * cexService.getTradingFee(exchangeId);

      // Step 3: INTERMEDIATE → USDT
      const finalAmount = (intermediateAmount - fee2) * prices[2]; // Back to USDT
      const fee3 = finalAmount * cexService.getTradingFee(exchangeId);

      const finalValue = finalAmount - fee3;
      const profit = finalValue - TRADE_AMOUNT_USD;

      // Calculate fees
      const fees: FeeBreakdown = {
        buyTradingFee: fee1,
        sellTradingFee: fee2 + fee3,
        withdrawalFee: 0, // No withdrawal for internal exchange arbitrage
        gasFee: 0,
        totalFees: fee1 + fee2 + fee3,
      };

      return {
        exchanges: [exchangeId, exchangeId, exchangeId],
        symbols: pairs,
        prices,
        estimatedProfit: profit,
        fees,
        netProfit: profit,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert triangular path to ArbitrageOpportunity format
   */
  private convertPathToOpportunity(exchangeId: string, path: TriangularPath): ArbitrageOpportunity {
    const netProfitPercentage = (path.netProfit / TRADE_AMOUNT_USD) * 100;

    return {
      symbol: path.symbols[0].split('/')[0], // First coin in the path
      type: 'triangular',
      buyExchange: exchangeId,
      sellExchange: exchangeId,
      buyPrice: path.prices[0],
      sellPrice: path.prices[path.prices.length - 1],
      priceDifference: path.netProfit,
      percentageDifference: netProfitPercentage,
      estimatedProfit: path.estimatedProfit,
      fees: path.fees,
      netProfit: path.netProfit,
      netProfitPercentage,
      timestamp: Date.now(),
      tradeAmount: TRADE_AMOUNT_USD,
      path: this.formatPath(path.symbols),
    };
  }

  /**
   * Format trading path for display
   */
  private formatPath(pairs: string[]): string[] {
    const path: string[] = ['USDT'];

    for (const pair of pairs) {
      const [base, quote] = pair.split('/');
      if (!path.includes(base)) {
        path.push(base);
      }
      if (!path.includes(quote)) {
        path.push(quote);
      }
    }

    // Ensure it loops back to USDT
    if (path[path.length - 1] !== 'USDT') {
      path.push('USDT');
    }

    return path;
  }

  /**
   * Scan triangular arbitrage on all major exchanges
   */
  async scanAllExchanges(symbols: string[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Only check major exchanges with good liquidity
    const majorExchanges = ['binance', 'bybit', 'okx', 'kucoin'];

    for (const exchangeId of majorExchanges) {
      try {
        const exchangeOpportunities = await this.findTriangularArbitrage(exchangeId, symbols);
        opportunities.push(...exchangeOpportunities);
      } catch (error) {
        Logger.debug(`Failed triangular scan on ${exchangeId}`);
      }
    }

    Logger.success(`Found ${opportunities.length} triangular arbitrage opportunities`);
    return opportunities;
  }
}

// Singleton instance
export const triangularArbitrageService = new TriangularArbitrageService();

import axios from 'axios';
import { DEXPrice, Price, GasFees } from '../types';
import { globalCache } from '../utils/cache';
import { Logger } from '../utils/logger';
import { SUPPORTED_CHAINS, CACHE_TTL } from '../config/config';

/**
 * Decentralized Exchange (DEX) service
 * Aggregates prices from DEXs across multiple chains using 1inch API
 */
export class DEXService {
  private readonly ONEINCH_API = 'https://api.1inch.dev/price/v1.1';
  private readonly NATIVE_TOKENS = new Map<string, string>([
    ['Ethereum', 'ETH'],
    ['BSC', 'BNB'],
    ['Polygon', 'MATIC'],
    ['Arbitrum', 'ETH'],
    ['Optimism', 'ETH'],
    ['Base', 'ETH'],
    ['Avalanche', 'AVAX'],
    ['Fantom', 'FTM'],
  ]);

  /**
   * Get DEX price for a token across all supported chains
   */
  async getDEXPrices(symbol: string): Promise<Price[]> {
    const prices: Price[] = [];

    // Only check low gas chains for efficiency
    const lowGasChains = SUPPORTED_CHAINS.filter(
      chain => chain.gasEstimate === 'very_low' || chain.gasEstimate === 'low'
    );

    for (const chain of lowGasChains) {
      try {
        const dexPrice = await this.getTokenPrice(symbol, chain.chainId, chain.name);
        if (dexPrice) {
          prices.push({
            exchange: `${chain.name}_DEX`,
            symbol,
            price: dexPrice.price,
            volume24h: dexPrice.liquidity,
            timestamp: dexPrice.timestamp,
            type: 'DEX',
            chain: chain.name,
          });
        }
      } catch (error) {
        Logger.debug(`Failed to get DEX price for ${symbol} on ${chain.name}`);
      }
    }

    return prices;
  }

  /**
   * Get token price on a specific chain using 1inch
   */
  private async getTokenPrice(
    symbol: string,
    chainId: number,
    chainName: string
  ): Promise<DEXPrice | null> {
    const cacheKey = `dex:${chainId}:${symbol}`;
    const cached = globalCache.get<DEXPrice>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // For demo purposes, we'll use a simplified approach
      // In production, you would need to:
      // 1. Get token contract address from a token list
      // 2. Query 1inch API or DEX aggregator
      // 3. Handle token address mapping

      // Placeholder: Skip DEX for now as it requires contract addresses
      // This would need additional setup with token address mapping
      return null;
    } catch (error) {
      Logger.debug(`DEX price fetch failed for ${symbol} on chain ${chainId}`);
      return null;
    }
  }

  /**
   * Get gas fees for a chain
   */
  async getGasFees(chainName: string): Promise<number> {
    const cacheKey = `gas:${chainName}`;
    const cached = globalCache.get<number>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // Estimate gas fees based on chain
      let gasEstimate = 0;

      switch (chainName) {
        case 'BSC':
          gasEstimate = 0.1; // ~$0.1
          break;
        case 'Polygon':
          gasEstimate = 0.05; // ~$0.05
          break;
        case 'Arbitrum':
        case 'Optimism':
        case 'Base':
          gasEstimate = 0.5; // ~$0.5
          break;
        case 'Avalanche':
          gasEstimate = 0.3; // ~$0.3
          break;
        case 'Fantom':
          gasEstimate = 0.05; // ~$0.05
          break;
        case 'Ethereum':
          gasEstimate = 5; // ~$5 (can be much higher)
          break;
        default:
          gasEstimate = 1;
      }

      globalCache.set(cacheKey, gasEstimate, CACHE_TTL.gasFees);
      return gasEstimate;
    } catch (error) {
      Logger.debug(`Failed to get gas fees for ${chainName}`);
      return 1; // Default $1
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains() {
    return SUPPORTED_CHAINS;
  }

  /**
   * Check if DEX is profitable after gas fees
   */
  async isDEXProfitable(
    chainName: string,
    priceDifference: number,
    tradeAmount: number
  ): Promise<boolean> {
    const gasFee = await this.getGasFees(chainName);
    const profit = (priceDifference / 100) * tradeAmount;
    return profit > gasFee;
  }
}

// Singleton instance
export const dexService = new DEXService();

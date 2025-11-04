import axios from 'axios';
import { Logger } from '../utils/logger';
import { globalCache } from '../utils/cache';
import { CACHE_TTL } from '../config/config';

/**
 * Exchange Status Service
 * Monitors exchange announcements for suspended withdrawals/deposits
 */
export class ExchangeStatusService {
  private suspendedTokens: Map<string, Set<string>> = new Map(); // exchange -> set of symbols
  private readonly CHECK_INTERVAL = 300000; // 5 minutes

  /**
   * Check if a token has suspended withdrawal/deposit on an exchange
   */
  isSuspended(exchange: string, symbol: string): boolean {
    const baseCoin = symbol.split('/')[0];
    const suspended = this.suspendedTokens.get(exchange.toLowerCase());
    return suspended?.has(baseCoin.toUpperCase()) || false;
  }

  /**
   * Check if arbitrage should be skipped due to suspended status
   */
  shouldSkipArbitrage(buyExchange: string, sellExchange: string, symbol: string): boolean {
    const baseCoin = symbol.split('/')[0];

    // Skip if withdrawal suspended on buy exchange (can't transfer out)
    if (this.isSuspended(buyExchange, baseCoin)) {
      Logger.debug(`Skipping ${symbol}: withdrawal suspended on ${buyExchange}`);
      return true;
    }

    // Skip if deposit suspended on sell exchange (can't transfer in)
    if (this.isSuspended(sellExchange, baseCoin)) {
      Logger.debug(`Skipping ${symbol}: deposit suspended on ${sellExchange}`);
      return true;
    }

    return false;
  }

  /**
   * Fetch suspended tokens from all exchanges
   */
  async updateSuspendedTokens(): Promise<void> {
    Logger.info('Checking exchange status for suspended tokens...');

    const exchanges = [
      { name: 'binance', checker: () => this.checkBinanceStatus() },
      { name: 'bybit', checker: () => this.checkBybitStatus() },
      { name: 'okx', checker: () => this.checkOKXStatus() },
      { name: 'gateio', checker: () => this.checkGateioStatus() },
      { name: 'kucoin', checker: () => this.checkKucoinStatus() },
      { name: 'htx', checker: () => this.checkHTXStatus() },
      { name: 'mexc', checker: () => this.checkMEXCStatus() },
      { name: 'bitget', checker: () => this.checkBitgetStatus() },
      { name: 'kraken', checker: () => this.checkKrakenStatus() },
      { name: 'bingx', checker: () => this.checkBingXStatus() },
    ];

    const results = await Promise.allSettled(
      exchanges.map(async ({ name, checker }) => {
        try {
          const suspended = await checker();
          if (suspended.size > 0) {
            this.suspendedTokens.set(name, suspended);
            Logger.warn(`${name}: ${suspended.size} tokens suspended - ${Array.from(suspended).slice(0, 5).join(', ')}...`);
          }
        } catch (error) {
          Logger.debug(`Failed to check ${name} status`);
        }
      })
    );

    Logger.success(`Exchange status updated. Total suspended tokens: ${this.getTotalSuspendedCount()}`);
  }

  /**
   * Check Binance for suspended tokens
   */
  private async checkBinanceStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:binance';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      // Binance API: Get all coins info
      const response = await axios.get('https://api.binance.com/sapi/v1/capital/config/getall', {
        timeout: 10000,
      });

      for (const coin of response.data) {
        const symbol = coin.coin.toUpperCase();

        // Check if withdrawal or deposit is disabled
        const hasActiveNetwork = coin.networkList?.some((network: any) =>
          network.withdrawEnable && network.depositEnable
        );

        if (!hasActiveNetwork) {
          suspended.add(symbol);
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('Binance status check failed');
    }

    return suspended;
  }

  /**
   * Check Bybit for suspended tokens
   */
  private async checkBybitStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:bybit';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://api.bybit.com/v5/asset/coin/query-info', {
        timeout: 10000,
      });

      if (response.data?.result?.rows) {
        for (const coin of response.data.result.rows) {
          const symbol = coin.coin?.toUpperCase();
          if (!symbol) continue;

          // Check if all chains have both deposit and withdrawal disabled
          const hasActiveChain = coin.chains?.some((chain: any) =>
            chain.chainDeposit === '1' && chain.chainWithdraw === '1'
          );

          if (!hasActiveChain) {
            suspended.add(symbol);
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('Bybit status check failed');
    }

    return suspended;
  }

  /**
   * Check OKX for suspended tokens
   */
  private async checkOKXStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:okx';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://www.okx.com/api/v5/asset/currencies', {
        timeout: 10000,
      });

      if (response.data?.data) {
        for (const coin of response.data.data) {
          const symbol = coin.ccy?.toUpperCase();
          if (!symbol) continue;

          // Check if deposit or withdrawal is disabled
          if (coin.canDep === false || coin.canWd === false) {
            suspended.add(symbol);
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('OKX status check failed');
    }

    return suspended;
  }

  /**
   * Check Gate.io for suspended tokens
   */
  private async checkGateioStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:gateio';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://api.gateio.ws/api/v4/wallet/currency_chains', {
        timeout: 10000,
      });

      if (Array.isArray(response.data)) {
        const coinStatus = new Map<string, boolean>();

        for (const chain of response.data) {
          const symbol = chain.currency?.toUpperCase();
          if (!symbol) continue;

          // If at least one chain is active, mark as not suspended
          if (chain.is_withdraw_disabled === false && chain.is_deposit_disabled === false) {
            coinStatus.set(symbol, false);
          } else if (!coinStatus.has(symbol)) {
            coinStatus.set(symbol, true);
          }
        }

        // Add only fully suspended tokens
        for (const [symbol, isSuspended] of coinStatus) {
          if (isSuspended) {
            suspended.add(symbol);
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('Gate.io status check failed');
    }

    return suspended;
  }

  /**
   * Get total count of suspended tokens across all exchanges
   */
  private getTotalSuspendedCount(): number {
    let total = 0;
    for (const tokens of this.suspendedTokens.values()) {
      total += tokens.size;
    }
    return total;
  }

  /**
   * Get all suspended tokens for an exchange
   */
  getSuspendedTokens(exchange: string): string[] {
    const suspended = this.suspendedTokens.get(exchange.toLowerCase());
    return suspended ? Array.from(suspended) : [];
  }

  /**
   * Check KuCoin for suspended tokens
   */
  private async checkKucoinStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:kucoin';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://api.kucoin.com/api/v1/currencies', {
        timeout: 10000,
      });

      if (response.data?.data) {
        for (const coin of response.data.data) {
          const symbol = coin.currency?.toUpperCase();
          if (!symbol) continue;

          // Check if withdrawal or deposit is disabled
          if (coin.isWithdrawEnabled === false || coin.isDepositEnabled === false) {
            suspended.add(symbol);
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('KuCoin status check failed');
    }

    return suspended;
  }

  /**
   * Check HTX (Huobi) for suspended tokens
   */
  private async checkHTXStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:htx';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://api.huobi.pro/v2/reference/currencies', {
        timeout: 10000,
      });

      if (response.data?.data) {
        for (const coin of response.data.data) {
          const symbol = coin.currency?.toUpperCase();
          if (!symbol) continue;

          // Check chains
          const hasActiveChain = coin.chains?.some((chain: any) =>
            chain.depositStatus === 'allowed' && chain.withdrawStatus === 'allowed'
          );

          if (!hasActiveChain) {
            suspended.add(symbol);
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('HTX status check failed');
    }

    return suspended;
  }

  /**
   * Check MEXC for suspended tokens
   */
  private async checkMEXCStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:mexc';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://api.mexc.com/api/v3/capital/config/getall', {
        timeout: 10000,
      });

      if (Array.isArray(response.data)) {
        for (const coin of response.data) {
          const symbol = coin.coin?.toUpperCase();
          if (!symbol) continue;

          // Check network list
          const hasActiveNetwork = coin.networkList?.some((network: any) =>
            network.withdrawEnable && network.depositEnable
          );

          if (!hasActiveNetwork) {
            suspended.add(symbol);
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('MEXC status check failed');
    }

    return suspended;
  }

  /**
   * Check Bitget for suspended tokens
   */
  private async checkBitgetStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:bitget';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://api.bitget.com/api/spot/v1/public/currencies', {
        timeout: 10000,
      });

      if (response.data?.data) {
        for (const coin of response.data.data) {
          const symbol = coin.coinName?.toUpperCase();
          if (!symbol) continue;

          // Check if chains exist and are active
          const hasActiveChain = coin.chains?.some((chain: any) =>
            chain.withdrawable === '1' && chain.rechargeable === '1'
          );

          if (!hasActiveChain) {
            suspended.add(symbol);
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('Bitget status check failed');
    }

    return suspended;
  }

  /**
   * Check Kraken for suspended tokens
   */
  private async checkKrakenStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:kraken';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://api.kraken.com/0/public/Assets', {
        timeout: 10000,
      });

      if (response.data?.result) {
        for (const [key, asset] of Object.entries(response.data.result)) {
          const assetData = asset as any;
          const symbol = assetData.altname?.toUpperCase();
          if (!symbol) continue;

          // Check deposit and withdrawal status
          if (assetData.status === 'disabled' ||
              assetData.deposit_enabled === false ||
              assetData.withdrawal_enabled === false) {
            suspended.add(symbol);
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('Kraken status check failed');
    }

    return suspended;
  }

  /**
   * Check Poloniex for suspended tokens
   */
  private async checkPoloniexStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:poloniex';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://api.poloniex.com/currencies', {
        timeout: 10000,
      });

      // Response is an array of objects with nested currency data
      if (Array.isArray(response.data)) {
        for (const item of response.data) {
          // Each item is an object with the currency symbol as the key
          for (const [symbol, coinInfo] of Object.entries(item)) {
            const info = coinInfo as any;

            // Check if trading, deposit, or withdrawal is disabled
            if (info.delisted === true ||
                info.tradingState !== 'NORMAL' ||
                info.walletState === 'DISABLED' ||
                info.walletDepositState === 'DISABLED' ||
                info.walletWithdrawalState === 'DISABLED') {
              suspended.add(symbol.toUpperCase());
            }
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('Poloniex status check failed');
    }

    return suspended;
  }

  /**
   * Check BingX for suspended tokens
   */
  private async checkBingXStatus(): Promise<Set<string>> {
    const cacheKey = 'exchange_status:bingx';
    const cached = globalCache.get<Set<string>>(cacheKey);
    if (cached) return cached;

    const suspended = new Set<string>();

    try {
      const response = await axios.get('https://open-api.bingx.com/openApi/wallets/v1/capital/config/getall', {
        timeout: 10000,
      });

      if (response.data?.data) {
        for (const coin of response.data.data) {
          const symbol = coin.coin?.toUpperCase();
          if (!symbol) continue;

          // Check network list
          const hasActiveNetwork = coin.networkList?.some((network: any) =>
            network.withdrawEnable === true && network.depositEnable === true
          );

          if (!hasActiveNetwork) {
            suspended.add(symbol);
          }
        }
      }

      globalCache.set(cacheKey, suspended, CACHE_TTL.exchangeInfo);
    } catch (error) {
      Logger.debug('BingX status check failed');
    }

    return suspended;
  }

  /**
   * Start periodic status checks
   */
  startMonitoring(): void {
    // Initial check
    this.updateSuspendedTokens();

    // Periodic checks every 5 minutes
    setInterval(() => {
      this.updateSuspendedTokens();
    }, this.CHECK_INTERVAL);

    Logger.info('Exchange status monitoring started (checks every 5 minutes)');
  }
}

// Singleton instance
export const exchangeStatusService = new ExchangeStatusService();

/**
 * Simple console logger with timestamps and colors
 */
export class Logger {
  private static formatTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').slice(0, -5);
  }

  static info(message: string, ...args: any[]): void {
    console.log(`[${this.formatTimestamp()}] ℹ️  ${message}`, ...args);
  }

  static success(message: string, ...args: any[]): void {
    console.log(`[${this.formatTimestamp()}] ✅ ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    console.warn(`[${this.formatTimestamp()}] ⚠️  ${message}`, ...args);
  }

  static error(message: string, ...args: any[]): void {
    console.error(`[${this.formatTimestamp()}] ❌ ${message}`, ...args);
  }

  static debug(message: string, ...args: any[]): void {
    if (process.env.DEBUG === 'true') {
      console.log(`[${this.formatTimestamp()}] 🔍 ${message}`, ...args);
    }
  }

  static arbitrage(message: string, ...args: any[]): void {
    console.log(`[${this.formatTimestamp()}] 💰 ${message}`, ...args);
  }

  static volume(message: string, ...args: any[]): void {
    console.log(`[${this.formatTimestamp()}] 📊 ${message}`, ...args);
  }
}

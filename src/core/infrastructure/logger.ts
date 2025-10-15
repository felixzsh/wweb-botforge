import pino from 'pino';
import { GlobalConfig } from '../domain/dtos/config.dto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export function createLogger(logLevel: LogLevel = 'info'): Logger {
  const logger = pino({
    level: logLevel,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  return {
    debug: (message: string, ...args: any[]) => logger.debug(args.length > 0 ? { args } : {}, message),
    info: (message: string, ...args: any[]) => logger.info(args.length > 0 ? { args } : {}, message),
    warn: (message: string, ...args: any[]) => logger.warn(args.length > 0 ? { args } : {}, message),
    error: (message: string, ...args: any[]) => logger.error(args.length > 0 ? { args } : {}, message),
  };
}

// Global logger instance that can be updated with config
let globalLogger: Logger = createLogger('info');

export function getLogger(): Logger {
  return globalLogger;
}

export function setGlobalLogger(config: GlobalConfig): void {
  const logLevel = config.logLevel || 'info';
  globalLogger = createLogger(logLevel);
}

// Default logger instance (will be replaced when config is loaded)
export const defaultLogger = createLogger('info');
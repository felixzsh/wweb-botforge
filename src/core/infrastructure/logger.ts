import pino from 'pino';
import { GlobalConfig } from '../domain/dtos/config.dto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

function getCallerInfo(): { file: string; line: number; func: string } | undefined {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (!isDevelopment) return undefined;

  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    const err = new Error();
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = err.stack as unknown as NodeJS.CallSite[];
    // index 2 refers to the actual caller, not the logger (0) and its level (1)
    const caller = stack[2];
    
    if (caller) {
      const fileName = caller.getFileName() || 'unknown';
      const lineNumber = caller.getLineNumber() || 0;
      const functionName = caller.getFunctionName() || 'anonymous';
      
      const shortFileName = fileName.split('/').pop() || fileName;
      
      return {
        file: shortFileName,
        line: lineNumber,
        func: functionName,
      };
    }
  } catch (e) {
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
  
  return undefined;
}

export function createLogger(logLevel: LogLevel = 'info'): Logger {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  const logger = pino({
    level: logLevel,
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname,caller',
            messageFormat: '{if caller}[{caller.file}:{caller.line}]{end} {msg}',
            singleLine: false,
            hideObject: true,
          },
        }
      : undefined,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  return {
    debug: (message: string, ...args: any[]) => {
      const caller = getCallerInfo();
      logger.debug({ ...(args.length > 0 ? { args } : {}), ...(caller ? { caller } : {}) }, message);
    },
    info: (message: string, ...args: any[]) => {
      const caller = getCallerInfo();
      logger.info({ ...(args.length > 0 ? { args } : {}), ...(caller ? { caller } : {}) }, message);
    },
    warn: (message: string, ...args: any[]) => {
      const caller = getCallerInfo();
      logger.warn({ ...(args.length > 0 ? { args } : {}), ...(caller ? { caller } : {}) }, message);
    },
    error: (message: string, ...args: any[]) => {
      const caller = getCallerInfo();
      logger.error({ ...(args.length > 0 ? { args } : {}), ...(caller ? { caller } : {}) }, message);
    },
  };
}

let globalLogger: Logger = createLogger('info');

export function getLogger(): Logger {
  return globalLogger;
}

export function setGlobalLogger(config: GlobalConfig): void {
  const logLevel = config.logLevel || 'info';
  globalLogger = createLogger(logLevel);
}

export const defaultLogger = createLogger('info');
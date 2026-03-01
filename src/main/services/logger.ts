import log from 'electron-log/main';

log.initialize();

log.transports.file.level = 'error';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : false;

log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

export const logger = log;

export function createLogger(scope: string) {
  return {
    debug: (...args: unknown[]) => log.debug(`[${scope}]`, ...args),
    info: (...args: unknown[]) => log.info(`[${scope}]`, ...args),
    warn: (...args: unknown[]) => log.warn(`[${scope}]`, ...args),
    error: (...args: unknown[]) => log.error(`[${scope}]`, ...args),
  };
}

export default log;

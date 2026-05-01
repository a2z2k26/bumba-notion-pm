'use strict';

/**
 * Lightweight logger. Emits to stderr so stdout stays clean for CLI piping.
 * Set BUMBA_NOTION_LOG_LEVEL=debug|info|warn|error|silent to control output.
 * Default: 'info'.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

function levelValue(name) {
  if (typeof name !== 'string') return LEVELS.info;
  const v = LEVELS[name.toLowerCase()];
  return typeof v === 'number' ? v : LEVELS.info;
}

function currentThreshold() {
  return levelValue(process.env.BUMBA_NOTION_LOG_LEVEL || 'info');
}

function format(level, args) {
  const ts = new Date().toISOString();
  const tag = `[${ts}] [${level.toUpperCase()}]`;
  return [tag, ...args];
}

function emit(level, args) {
  if (levelValue(level) < currentThreshold()) return;
  const out = format(level, args);
  if (level === 'error' || level === 'warn') {
    console.error(...out);
  } else {
    console.error(...out);
  }
}

const logger = {
  debug: (...args) => emit('debug', args),
  info: (...args) => emit('info', args),
  warn: (...args) => emit('warn', args),
  error: (...args) => emit('error', args),
  child(_context) {
    return logger;
  }
};

module.exports = { logger, LEVELS };

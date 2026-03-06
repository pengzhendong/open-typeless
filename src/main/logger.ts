/**
 * Logger configuration.
 * Must be imported before any service that uses electron-log.
 */

import log from 'electron-log';

// Disable console output, keep file logging only
log.transports.console.level = false;

// Configure file transport
log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB

export const logger = log.scope('main');
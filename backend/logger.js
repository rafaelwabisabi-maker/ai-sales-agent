/**
 * Structured Logger
 *
 * JSON logs in production (Railway reads these natively).
 * Pretty-print in development.
 */

'use strict';

const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const logger = pino({
  level,
  ...(isProduction ? {} : {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  })
});

module.exports = logger;

/**
 * Structured Logging with Winston
 * 
 * Environment Variables:
 * - NODE_ENV: Environment (production, development, test)
 * - LOG_LEVEL: Logging level (error, warn, info, debug, verbose)
 * - LOG_FILE: Log file path (default: logs/app.log)
 */

import winston from "winston";
import path from "path";
import fs from "fs";

const logDir = "logs";

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");
const logFile = process.env.LOG_FILE || path.join(logDir, "app.log");
const errorLogFile = path.join(logDir, "error.log");

// Custom format for console (colorized, human-readable)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// JSON format for file (structured, parseable)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create Winston logger instance
export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: {
    service: "saas-lhfex",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    // Console output (pretty-printed in dev, JSON in production)
    new winston.transports.Console({
      format: process.env.NODE_ENV === "production" ? fileFormat : consoleFormat,
    }),

    // File output - all logs
    new winston.transports.File({
      filename: logFile,
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // File output - errors only
    new winston.transports.File({
      filename: errorLogFile,
      level: "error",
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "exceptions.log"),
      format: fileFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, "rejections.log"),
      format: fileFormat,
    }),
  ],
});

// Suppress logs in test environment unless explicitly enabled
if (process.env.NODE_ENV === "test" && !process.env.LOG_TESTS) {
  logger.transports.forEach((transport) => {
    transport.silent = true;
  });
}

/**
 * Helper functions for common log patterns
 */
export const log = {
  error: (message: string, meta?: Record<string, unknown>) => {
    logger.error(message, meta);
  },

  warn: (message: string, meta?: Record<string, unknown>) => {
    logger.warn(message, meta);
  },

  info: (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, meta);
  },

  debug: (message: string, meta?: Record<string, unknown>) => {
    logger.debug(message, meta);
  },

  http: (method: string, url: string, status: number, duration: number, meta?: Record<string, unknown>) => {
    logger.info("HTTP Request", {
      method,
      url,
      status,
      duration,
      ...meta,
    });
  },

  db: (operation: string, table: string, duration: number, meta?: Record<string, unknown>) => {
    logger.debug("Database Query", {
      operation,
      table,
      duration,
      ...meta,
    });
  },

  auth: (action: string, userId?: string, success?: boolean, meta?: Record<string, unknown>) => {
    logger.info("Auth Event", {
      action,
      userId,
      success,
      ...meta,
    });
  },

  api: (provider: string, endpoint: string, status: number, duration: number, meta?: Record<string, unknown>) => {
    logger.info("External API Call", {
      provider,
      endpoint,
      status,
      duration,
      ...meta,
    });
  },
};

/**
 * Express/React Router middleware for request logging
 */
export function requestLogger(req: Request, startTime: number) {
  const duration = Date.now() - startTime;
  const url = new URL(req.url);
  
  log.http(
    req.method,
    url.pathname,
    200, // Status will be updated by response
    duration,
    {
      query: Object.fromEntries(url.searchParams),
      userAgent: req.headers.get("user-agent"),
    }
  );
}

/**
 * Log application startup
 */
export function logStartup(port: number | string) {
  logger.info("🚀 Application started", {
    port,
    nodeVersion: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV,
  });
}

/**
 * Log application shutdown
 */
export function logShutdown(reason: string) {
  logger.info("🛑 Application shutting down", { reason });
}

export default logger;

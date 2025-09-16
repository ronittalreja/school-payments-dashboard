const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Generic log writer
const writeLog = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  const filename = `${level}-${new Date().toISOString().split('T')[0]}.log`;
  const filepath = path.join(logsDir, filename);

  fs.appendFile(filepath, logLine, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
};

// Middleware to log requests
const requestLogger = (req, res, next) => {
  const start = Date.now();

  const requestInfo = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer')
  };

  console.log(`${requestInfo.method} ${requestInfo.url} - ${requestInfo.ip}`);

  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - start;

    const responseInfo = {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    };

    writeLog('info', `${requestInfo.method} ${requestInfo.url}`, {
      request: requestInfo,
      response: responseInfo
    });

    console.log(`${requestInfo.method} ${requestInfo.url} - ${res.statusCode} - ${duration}ms`);

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Middleware to log errors
const errorLogger = (err, req, res, next) => {
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query
  };

  writeLog('error', err.message, errorInfo);
  console.error('Error:', errorInfo);

  next(err);
};

// Logger object for manual logging
const logger = {
  info: (message, meta) => {
    console.log(`INFO: ${message}`, meta || '');
    writeLog('info', message, meta);
  },

  warn: (message, meta) => {
    console.warn(`WARN: ${message}`, meta || '');
    writeLog('warn', message, meta);
  },

  error: (message, meta) => {
    console.error(`ERROR: ${message}`, meta || '');
    writeLog('error', message, meta);
  },

  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`DEBUG: ${message}`, meta || '');
      writeLog('debug', message, meta);
    }
  }
};

module.exports = {
  requestLogger,
  errorLogger,
  logger
};

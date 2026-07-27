function writeLog(level, message, context = {}) {
    if (process.env.NODE_ENV === 'test') {
      return
    }

    const output = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    })

    if (level === 'error') {
      console.error(output)
      return
    }

    if (level === 'warn') {
      console.warn(output)
      return
    }

    console.log(output)
  }

  export const logger = Object.freeze({
    info: (message, context) =>
      writeLog('info', message, context),

    warn: (message, context) =>
      writeLog('warn', message, context),

    error: (message, context) =>
      writeLog('error', message, context),
  })

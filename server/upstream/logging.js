function createLogger(stream = process.stdout) {
  function write(level, event, fields = {}) {
    const line = JSON.stringify({
      at: new Date().toISOString(),
      event,
      level,
      ...fields,
    });
    stream.write(`${line}\n`);
  }

  return {
    error: (event, fields) => write("error", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
  };
}

function errorFields(error) {
  return {
    code: error.code || "",
    message: error.message || String(error),
  };
}

module.exports = { createLogger, errorFields };


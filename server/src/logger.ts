import { promises as fs } from "fs";
import path from "path";

type LogLevel = "Verbose" | "Debug" | "Information" | "Warning" | "Error" | "Fatal";

type LogEvent = {
  timestamp: string;
  level: LogLevel;
  messageTemplate: string;
  renderedMessage: string;
  properties?: Record<string, unknown>;
  exception?: string;
};

class Logger {
  constructor(private readonly context: Record<string, unknown> = {}) {}

  forContext(properties: Record<string, unknown>) {
    return new Logger({ ...this.context, ...properties });
  }

  verbose(messageTemplate: string, properties?: Record<string, unknown>) {
    return this.write("Verbose", messageTemplate, properties);
  }

  debug(messageTemplate: string, properties?: Record<string, unknown>) {
    return this.write("Debug", messageTemplate, properties);
  }

  information(messageTemplate: string, properties?: Record<string, unknown>) {
    return this.write("Information", messageTemplate, properties);
  }

  warning(messageTemplate: string, properties?: Record<string, unknown>) {
    return this.write("Warning", messageTemplate, properties);
  }

  error(
    messageTemplate: string,
    error?: unknown,
    properties?: Record<string, unknown>,
  ) {
    return this.write("Error", messageTemplate, properties, error);
  }

  fatal(
    messageTemplate: string,
    error?: unknown,
    properties?: Record<string, unknown>,
  ) {
    return this.write("Fatal", messageTemplate, properties, error);
  }

  private async write(
    level: LogLevel,
    messageTemplate: string,
    properties?: Record<string, unknown>,
    error?: unknown,
  ) {
    const mergedProperties = {
      ...this.context,
      ...(properties ?? {}),
    };

    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      messageTemplate,
      renderedMessage: renderMessage(messageTemplate, mergedProperties),
      properties: Object.keys(mergedProperties).length > 0 ? mergedProperties : undefined,
      exception: error ? serializeError(error) : undefined,
    };

    const line = `${JSON.stringify(event)}\n`;
    const logDirectory = path.resolve(process.cwd(), "logs");
    const logFile = path.join(logDirectory, `${event.timestamp.slice(0, 10)}.log`);

    try {
      await fs.mkdir(logDirectory, { recursive: true });
      await fs.appendFile(logFile, line, "utf8");
    } catch {
      // Intentionally swallow file logger errors so translation flow keeps running.
    }

    writeConsole(event);
  }
}

export const Log = new Logger();

function renderMessage(messageTemplate: string, properties: Record<string, unknown>) {
  return messageTemplate.replace(/\{([^}]+)\}/g, (_match, token) => {
    const value = properties[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }

  return String(error);
}

function writeConsole(event: LogEvent) {
  const prefix = `[${event.timestamp}] [${event.level}] ${event.renderedMessage}`;
  const extras = event.properties ? ` ${JSON.stringify(event.properties)}` : "";
  const exception = event.exception ? `\n${event.exception}` : "";

  if (event.level === "Error" || event.level === "Fatal") {
    console.error(`${prefix}${extras}${exception}`);
    return;
  }

  console.log(`${prefix}${extras}`);
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  event: string;
  [key: string]: unknown;
}

export interface StructuredLogger {
  log(level: LogLevel, record: LogRecord): void;
}

export class ConsoleJsonLogger implements StructuredLogger {
  log(level: LogLevel, record: LogRecord): void {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      ...record,
    });
    if (level === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }
}

export const nullLogger: StructuredLogger = {
  log: () => undefined,
};

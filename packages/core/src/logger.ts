export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type LogHandler = (message: string, level: LogLevel) => void;

const defaultHandler: LogHandler = (message, level) => {
  const prefix = `[TAAnalytics] ${message}`;
  switch (level) {
    case 'error':
      console.error(prefix);
      break;
    case 'warn':
      console.warn(prefix);
      break;
    case 'debug':
      console.debug(prefix);
      break;
    default:
      console.log(prefix);
  }
};

export const TALogger = {
  activeLogHandler: defaultHandler,
  log(message: string, level: LogLevel = 'info') {
    try {
      this.activeLogHandler(message, level);
    } catch {
      defaultHandler(message, level);
    }
  },
};

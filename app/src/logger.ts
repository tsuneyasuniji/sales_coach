/**
 * logger.ts
 *  シンプルなロガー
 */

export const logger = {
    info: (...args: any[]) => {
      console.log("[INFO]", ...args);
    },
    error: (...args: any[]) => {
      console.error("[ERROR]", ...args);
    },
  };
  
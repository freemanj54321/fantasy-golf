export class Logger {
    constructor(private prefix: string) {}

    info(message: string, ...args: unknown[]): void {
        console.log(`[${this.prefix}] ${message}`, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        console.warn(`[${this.prefix}] ${message}`, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        console.error(`[${this.prefix}] ${message}`, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        const env = (import.meta as any).env;
        if (env?.MODE === 'development' || env?.DEV) {
            console.debug(`[${this.prefix}] ${message}`, ...args);
        }
    }
}

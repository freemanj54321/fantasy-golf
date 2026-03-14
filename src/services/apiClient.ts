import { rapidApiConfig } from '../rapidApiConfig';
import { Logger } from '../lib/logger';

// Constants
const GOLF_API_HOST = 'live-golf-data.p.rapidapi.com';
const DEFAULT_ORG_ID = '1';
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_DELAY_MS = 100; // 100ms between requests

export { GOLF_API_HOST, DEFAULT_ORG_ID };

const logger = new Logger('RapidAPI');

// Cache entry interface
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// API Client Configuration
class RapidApiClient {
    private apiKey: string;
    private host: string;
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private lastRequestTime = 0;
    private activeRequests: Map<string, AbortController> = new Map();

    constructor(host: string = GOLF_API_HOST) {
        this.host = host;
        // Access env through type assertion since Vite types may not be fully loaded
        const env = (import.meta as any).env;
        this.apiKey = rapidApiConfig.apiKey || env?.VITE_RAPIDAPI_API_KEY || '';

        if (!this.apiKey) {
            const errorMessage = "RapidAPI key is not configured. Please set VITE_RAPIDAPI_API_KEY in your .env file.";
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        logger.info('RapidAPI client initialized');
    }

    private getHeaders(): HeadersInit {
        return {
            'X-RapidAPI-Key': this.apiKey,
            'X-RapidAPI-Host': this.host
        };
    }

    private getCacheKey(url: string): string {
        return url;
    }

    private getFromCache<T>(url: string): T | null {
        const cacheKey = this.getCacheKey(url);
        const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;

        if (!entry) {
            return null;
        }

        const age = Date.now() - entry.timestamp;
        if (age > CACHE_TTL_MS) {
            this.cache.delete(cacheKey);
            logger.debug(`Cache expired for ${url}`);
            return null;
        }

        logger.debug(`Cache hit for ${url}`);
        return entry.data;
    }

    private setCache<T>(url: string, data: T): void {
        const cacheKey = this.getCacheKey(url);
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        logger.debug(`Cached response for ${url}`);
    }

    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
            const delay = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
            logger.debug(`Rate limiting: waiting ${delay}ms`);
            await this.sleep(delay);
        }

        this.lastRequestTime = Date.now();
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number, abortController: AbortController): Promise<Response> {
        const timeoutId = setTimeout(() => {
            abortController.abort();
            logger.warn(`Request timeout after ${timeoutMs}ms: ${url}`);
        }, timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: abortController.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    private async retryWithBackoff<T>(
        fn: () => Promise<T>,
        retries: number = MAX_RETRIES,
        delay: number = INITIAL_RETRY_DELAY_MS
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            if (retries === 0) {
                logger.error('Max retries reached', error);
                throw error;
            }

            // Check if it's a retriable error (network issues, 5xx errors, timeouts)
            const isRetriable = error instanceof Error && (
                error.name === 'AbortError' ||
                error.message.includes('status 5') ||
                error.message.includes('fetch') ||
                error.message.includes('network')
            );

            if (!isRetriable) {
                throw error;
            }

            logger.warn(`Request failed, retrying in ${delay}ms (${retries} retries left)`, error);
            await this.sleep(delay);

            // Exponential backoff: double the delay for next retry
            return this.retryWithBackoff(fn, retries - 1, delay * 2);
        }
    }

    async get<T>(url: string, options: { useCache?: boolean; timeout?: number } = {}): Promise<T> {
        const { useCache = true, timeout = DEFAULT_TIMEOUT_MS } = options;

        // Check cache first
        if (useCache) {
            const cachedData = this.getFromCache<T>(url);
            if (cachedData !== null) {
                return cachedData;
            }
        }

        // Enforce rate limiting
        await this.enforceRateLimit();

        // Create abort controller for this request
        const abortController = new AbortController();
        const requestId = `${Date.now()}-${Math.random()}`;
        this.activeRequests.set(requestId, abortController);

        try {
            const result = await this.retryWithBackoff(async () => {
                const fetchOptions = {
                    method: 'GET',
                    headers: this.getHeaders()
                };

                logger.debug(`Fetching ${url}`);
                const response = await this.fetchWithTimeout(url, fetchOptions, timeout, abortController);

                if (!response.ok) {
                    const errorText = await response.text();
                    let errorMessage = `API request failed with status ${response.status}`;

                    try {
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.message || errorMessage;
                    } catch {
                        errorMessage = errorText || errorMessage;
                    }

                    logger.error(`Request failed: ${errorMessage}`, { url, status: response.status });
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                logger.info(`Successfully fetched ${url}`);
                return data as T;
            });

            // Cache the result
            if (useCache) {
                this.setCache(url, result);
            }

            return result;
        } catch (error) {
            logger.error(`Error fetching from ${url}:`, error);
            throw error;
        } finally {
            this.activeRequests.delete(requestId);
        }
    }

    // Cancel a specific request or all active requests
    cancelRequests(requestId?: string): void {
        if (requestId) {
            const controller = this.activeRequests.get(requestId);
            if (controller) {
                controller.abort();
                this.activeRequests.delete(requestId);
                logger.info(`Cancelled request ${requestId}`);
            }
        } else {
            // Cancel all active requests
            this.activeRequests.forEach((controller, id) => {
                controller.abort();
                logger.info(`Cancelled request ${id}`);
            });
            this.activeRequests.clear();
        }
    }

    // Clear the cache
    clearCache(): void {
        this.cache.clear();
        logger.info('Cache cleared');
    }

    // Get cache stats
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

export const apiClient = new RapidApiClient();

// Interfaces shared with other service modules
export interface PgaSchedule {
    tournId: string;
    tournName: string;
    year: number;
    startDate: string | null;   // ISO string e.g. "2026-01-15T00:00:00"
    endDate: string | null;     // ISO string e.g. "2026-01-18T00:00:00"
    weekNumber: number | null;
    format: string;
    purse: number;
    winnersShare: number | null;
    fedexCupPoints: number | null;
}

export interface SyncResult {
    createdCount: number;
    updatedCount: number;
}

// Utility functions for cache and request management
export const clearApiCache = (): void => {
    apiClient.clearCache();
};

export const getApiCacheStats = (): { size: number; keys: string[] } => {
    return apiClient.getCacheStats();
};

export const cancelApiRequests = (): void => {
    apiClient.cancelRequests();
};

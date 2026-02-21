import 'reflect-metadata';
import { Container } from 'typedi';
import ServiceClient from './service-client';
import { ContainerToken } from './config';
import config from './config';
import { InitOptions } from './types';
import logger from './utils/logger';

/**
 * Initialize the redis-cache-wrapper package.
 *
 * Sets up the TypeDI container with provided connections (Redis, MySQL, MongoDB).
 *
 * @param options - Configuration and connection instances.
 *
 * @example
 * ```ts
 * import { init, serviceClient, config } from 'redis-cache-wrapper';
 *
 * await init({
 *   redisClient: myRedisClient,
 *   sqlPool: mySqlPool,
 *   mongoDb: myMongoDb,
 * });
 *
 * // Now use serviceClient anywhere
 * const user = await serviceClient.getCachedOne(
 *   { key: 'user:1', field: 'info', expirationInSec: config.Expiry.LONG },
 *   'SELECT * FROM users WHERE id = ?',
 *   [1]
 * );
 * ```
 */
export async function init({ redisClient = null, sqlPool = null, mongoDb = null, redisEnabled = true }: InitOptions = {}): Promise<void> {
    try {
        // Register connections in TypeDI container
        Container.set(ContainerToken.REDIS, redisClient);
        Container.set(ContainerToken.SQL_POOL, sqlPool);
        Container.set(ContainerToken.MONGO_DB, mongoDb);

        // Initialize the service client (triggers TypeDI to wire everything)
        const client = Container.get(ServiceClient);

        // Set redis enabled/disabled state
        client.setRedisEnabled(redisEnabled);

        // Verify connections
        if (redisClient) {
            client.connect();
        }
    } catch (err) {
        logger.error(err, '[rodex][init] Initialization failed');
        throw err;
    }
}

/**
 * Proxy accessor for ServiceClient.
 * Ensures the latest instance is always retrieved from the TypeDI container.
 *
 * Usage: `serviceClient.get('key')`, `serviceClient.getCached(...)` etc.
 */
export const serviceClient = new Proxy({} as ServiceClient, {
    get: (_target, prop) => {
        const instance = Container.get(ServiceClient) as unknown as Record<string | symbol, unknown>;
        if (!instance) {
            throw new Error('redis-cache-wrapper not initialized. Call init() first.');
        }
        const item = instance[prop];
        return typeof item === 'function' ? (item as (...args: unknown[]) => unknown).bind(instance) : item;
    },
});

export { config };

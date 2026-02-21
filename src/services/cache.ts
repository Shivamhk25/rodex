import { Service } from 'typedi';
import RedisWrapper from '../wrappers/redis';
import DatabaseWrapper from '../wrappers/database';
import { CacheOptions } from '../types';
import { DbType } from '../config';
import logger from '../utils/logger';

/**
 * CacheService implements the Cache-Aside pattern.
 *
 * Flow: Check Redis → Cache miss → Query DB → Write to Redis → Return
 */
@Service()
export default class CacheService {
    constructor(private readonly redis: RedisWrapper, private readonly db: DatabaseWrapper) {}

    /**
     * Get data using cache-aside pattern with SQL database.
     * Checks Redis first. On miss, queries SQL DB, caches result, and returns.
     */
    public async getCached<T>(options: CacheOptions, sql: string, params: (number | string | boolean | null)[] = []): Promise<T[]> {
        try {
            const cached = await this.readFromCache(options);
            if (cached !== null) return cached as T[];

            const dbResult = await this.db.executeSqlQuery<T>(sql, params);
            if (dbResult && dbResult.length > 0) {
                this.writeToCache(options, dbResult).catch((err) => {
                    logger.warn(err, '[CacheService] Failed to write cache');
                });
            }
            return dbResult;
        } catch (err) {
            logger.error(err, '[CacheService][getCached] Error, falling back to DB');
            return this.db.executeSqlQuery<T>(sql, params);
        }
    }

    /**
     * Get single record using cache-aside with SQL.
     */
    public async getCachedOne<T>(options: CacheOptions, sql: string, params: (number | string | boolean | null)[] = []): Promise<T | null> {
        const results = await this.getCached<T>(options, sql, params);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Get data using cache-aside with MongoDB.
     * Checks Redis first. On miss, queries MongoDB, caches result, and returns.
     */
    public async getCachedMongo<T>(
        options: CacheOptions,
        collectionName: string,
        query: Record<string, unknown> = {},
        findOptions?: { limit?: number; skip?: number; sort?: Record<string, unknown> }
    ): Promise<T[]> {
        try {
            const cached = await this.readFromCache(options);
            if (cached !== null) return cached as T[];

            const dbResult = await this.db.mongoFind<T>(collectionName, query, findOptions);
            if (dbResult && dbResult.length > 0) {
                this.writeToCache(options, dbResult).catch((err) => {
                    logger.warn(err, '[CacheService] Failed to write MongoDB cache');
                });
            }
            return dbResult;
        } catch (err) {
            logger.error(err, '[CacheService][getCachedMongo] Error, falling back to DB');
            return this.db.mongoFind<T>(collectionName, query, findOptions);
        }
    }

    /**
     * Get single MongoDB document with cache-aside.
     */
    public async getCachedMongoOne<T>(options: CacheOptions, collectionName: string, query: Record<string, unknown>): Promise<T | null> {
        try {
            const cached = await this.readFromCache(options);
            if (cached !== null) {
                const arr = cached as T[];
                return arr.length > 0 ? arr[0] : null;
            }

            const dbResult = await this.db.mongoFindOne<T>(collectionName, query);
            if (dbResult) {
                this.writeToCache(options, [dbResult]).catch((err) => {
                    logger.warn(err, '[CacheService] Failed to write MongoDB cache');
                });
            }
            return dbResult;
        } catch (err) {
            logger.error(err, '[CacheService][getCachedMongoOne] Error, falling back to DB');
            return this.db.mongoFindOne<T>(collectionName, query);
        }
    }

    /**
     * Invalidate a cached key (or a specific hash field).
     */
    public async invalidate(key: string, field?: string): Promise<void> {
        try {
            if (field) {
                await this.redis.hDel(key, field);
            } else {
                await this.redis.del(key);
            }
        } catch (err) {
            logger.warn(err, '[CacheService][invalidate] Error');
        }
    }

    /**
     * Invalidate all keys matching a pattern.
     */
    public async invalidateByPattern(pattern: string): Promise<number> {
        return this.redis.unlinkByPattern(pattern);
    }

    /**
     * Get the primary DB type (for external logic).
     */
    public getDbType(): DbType {
        if (this.db.getMongoDb() && !this.db.getSqlPool()) return DbType.MongoDB;
        return DbType.MySQL;
    }

    // ==================== Private Helpers ====================

    private async readFromCache(options: CacheOptions): Promise<unknown | null> {
        const { key, field } = options;

        if (field) {
            const cached = await this.redis.hGet(key, field);
            if (cached && cached[field]) {
                try {
                    return JSON.parse(cached[field] as string);
                } catch {
                    return null;
                }
            }
        } else {
            const cached = await this.redis.get(key);
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch {
                    return null;
                }
            }
        }
        return null;
    }

    private async writeToCache(options: CacheOptions, data: unknown): Promise<void> {
        const { key, field, expirationInSec } = options;
        const serialized = JSON.stringify(data);

        if (field) {
            await this.redis.hSetField(key, field, serialized, expirationInSec || null);
        } else {
            await this.redis.set(key, serialized, expirationInSec || null);
        }
    }
}

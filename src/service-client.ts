import { Service } from 'typedi';
import RedisWrapper from './wrappers/redis';
import DatabaseWrapper from './wrappers/database';
import CacheService from './services/cache';
import { CacheOptions, MongoDb } from './types';

/**
 * ServiceClient is the single entry point for all package operations.
 * It orchestrates RedisWrapper, DatabaseWrapper, and CacheService.
 *
 * All methods are accessible through this single class.
 */
@Service()
export default class ServiceClient {
    constructor(private readonly redisWrapper: RedisWrapper, private readonly databaseWrapper: DatabaseWrapper, private readonly cacheService: CacheService) {}

    // ==================== Redis Operations ====================

    /** Connect / get the Redis client */
    public connect() {
        return this.redisWrapper.connect();
    }

    /** GET a string value by key */
    public async get(key: string): Promise<string | null> {
        return this.redisWrapper.get(key);
    }

    /** SET a string value with optional TTL */
    public async set(key: string, value: string | number | boolean | null, expirationInSec: number | null = null): Promise<void> {
        return this.redisWrapper.set(key, value, expirationInSec);
    }

    /** HGET — retrieve hash fields (single field, array, or all) */
    public async hGet(key: string, fields: string[] | string | null = null): Promise<{ [key: string]: string | number | boolean | null } | null> {
        return this.redisWrapper.hGet(key, fields);
    }

    /** HMSET — set multiple hash fields */
    public async hSet(key: string, data: { [key: string]: string | number | boolean | null }, expirationInSec: number | null = null): Promise<void> {
        return this.redisWrapper.hSet(key, data, expirationInSec);
    }

    /** HSET — set a single hash field */
    public async hSetField(key: string, fieldName: string, data: string | number | boolean | null, expirationInSec: number | null = null): Promise<void> {
        return this.redisWrapper.hSetField(key, fieldName, data, expirationInSec);
    }

    /** DEL — delete a key */
    public async del(key: string): Promise<number> {
        return this.redisWrapper.del(key);
    }

    /** SCAN — find keys matching a pattern */
    public async scan(pattern: string, batchSize = 100): Promise<string[]> {
        return this.redisWrapper.scan(pattern, batchSize);
    }

    /** UNLINK — async delete a key */
    public async unlink(key: string): Promise<number> {
        return this.redisWrapper.unlink(key);
    }

    /** UNLINK by pattern — async delete all matching keys */
    public async unlinkByPattern(pattern: string, batchSize = 100): Promise<number> {
        return this.redisWrapper.unlinkByPattern(pattern, batchSize);
    }

    /** HDEL — delete hash fields */
    public async hDel(key: string, fields: string | string[]): Promise<number> {
        return this.redisWrapper.hDel(key, fields);
    }

    /** Enable or disable Redis */
    public setRedisEnabled(enabled: boolean): void {
        this.redisWrapper.setEnabled(enabled);
    }

    /** Check if Redis is enabled */
    public isRedisEnabled(): boolean {
        return this.redisWrapper.isEnabled();
    }

    /** Gracefully quit Redis */
    public async quit(): Promise<void> {
        return this.redisWrapper.quit();
    }

    // ==================== SQL Database Operations ====================

    /** Execute a SQL query with auto-retry */
    public async executeSqlQuery<T>(sql: string, params: (number | string | boolean | null)[] = []): Promise<T[]> {
        return this.databaseWrapper.executeSqlQuery<T>(sql, params);
    }

    // ==================== MongoDB Operations ====================

    /** Find documents in a MongoDB collection */
    public async mongoFind<T>(collectionName: string, query: Record<string, unknown> = {}, options?: { limit?: number; skip?: number; sort?: Record<string, unknown> }): Promise<T[]> {
        return this.databaseWrapper.mongoFind<T>(collectionName, query, options);
    }

    /** Find a single document */
    public async mongoFindOne<T>(collectionName: string, query: Record<string, unknown>): Promise<T | null> {
        return this.databaseWrapper.mongoFindOne<T>(collectionName, query);
    }

    /** Insert a document */
    public async mongoInsertOne(collectionName: string, doc: Record<string, unknown>): Promise<{ insertedId: unknown }> {
        return this.databaseWrapper.mongoInsertOne(collectionName, doc);
    }

    /** Update a document */
    public async mongoUpdateOne(collectionName: string, filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ modifiedCount: number }> {
        return this.databaseWrapper.mongoUpdateOne(collectionName, filter, update);
    }

    /** Delete a document */
    public async mongoDeleteOne(collectionName: string, filter: Record<string, unknown>): Promise<{ deletedCount: number }> {
        return this.databaseWrapper.mongoDeleteOne(collectionName, filter);
    }

    /** Run an aggregation pipeline */
    public async mongoAggregate<T>(collectionName: string, pipeline: Record<string, unknown>[]): Promise<T[]> {
        return this.databaseWrapper.mongoAggregate<T>(collectionName, pipeline);
    }

    /** Get raw MongoDB Db instance */
    public getMongo(): MongoDb | null {
        return this.databaseWrapper.getMongo();
    }

    // ==================== Cache-Aside Operations ====================

    /** Cache-aside GET with SQL fallback (returns array) */
    public async getCached<T>(options: CacheOptions, sql: string, params: (number | string | boolean | null)[] = []): Promise<T[]> {
        return this.cacheService.getCached<T>(options, sql, params);
    }

    /** Cache-aside GET with SQL fallback (returns single or null) */
    public async getCachedOne<T>(options: CacheOptions, sql: string, params: (number | string | boolean | null)[] = []): Promise<T | null> {
        return this.cacheService.getCachedOne<T>(options, sql, params);
    }

    /** Cache-aside GET with MongoDB fallback (returns array) */
    public async getCachedMongo<T>(
        options: CacheOptions,
        collectionName: string,
        query: Record<string, unknown> = {},
        findOptions?: { limit?: number; skip?: number; sort?: Record<string, unknown> }
    ): Promise<T[]> {
        return this.cacheService.getCachedMongo<T>(options, collectionName, query, findOptions);
    }

    /** Cache-aside GET with MongoDB fallback (returns single or null) */
    public async getCachedMongoOne<T>(options: CacheOptions, collectionName: string, query: Record<string, unknown>): Promise<T | null> {
        return this.cacheService.getCachedMongoOne<T>(options, collectionName, query);
    }

    /** Invalidate a cached key or hash field */
    public async invalidate(key: string, field?: string): Promise<void> {
        return this.cacheService.invalidate(key, field);
    }

    /** Invalidate all keys matching a pattern */
    public async invalidateByPattern(pattern: string): Promise<number> {
        return this.cacheService.invalidateByPattern(pattern);
    }
}

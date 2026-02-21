import { Pool } from 'mysql2/promise';
import { RedisClient } from 'redis';
import { DbType } from '../config';

/**
 * MongoDB-compatible Db interface (so we don't force a hard dependency on mongodb driver).
 * User passes their own connected Db instance.
 */
export interface MongoDb {
    collection(name: string): MongoCollection;
}

export interface MongoCollection {
    find(query: Record<string, unknown>): MongoCursor;
    findOne(query: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    insertOne(doc: Record<string, unknown>): Promise<{ insertedId: unknown }>;
    insertMany(docs: Record<string, unknown>[]): Promise<{ insertedIds: unknown[] }>;
    updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ modifiedCount: number }>;
    updateMany(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ modifiedCount: number }>;
    deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
    deleteMany(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
    aggregate(pipeline: Record<string, unknown>[]): MongoCursor;
    countDocuments(query?: Record<string, unknown>): Promise<number>;
}

export interface MongoCursor {
    toArray(): Promise<Record<string, unknown>[]>;
    limit(n: number): MongoCursor;
    skip(n: number): MongoCursor;
    sort(sort: Record<string, unknown>): MongoCursor;
}

/**
 * Initialization options for the package.
 */
export interface InitOptions {
    /** Redis client instance */
    redisClient?: RedisClient | null;
    /** Whether Redis is enabled. Default: true */
    redisEnabled?: boolean;
    /** MySQL connection pool */
    sqlPool?: Pool | null;
    /** MongoDB Db instance */
    mongoDb?: MongoDb | null;
    /** Primary database type to use for cache-aside queries. Default: 'mysql' */
    primaryDb?: DbType;
    /** Log level. Default: 'warn' */
    logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    /** Logger name. Default: 'redis-cache-wrapper' */
    loggerName?: string;
}

/**
 * Options for cache-aside `getCached` method.
 */
export interface CacheOptions {
    /** Redis key to cache under */
    key: string;
    /** Optional hash field name (uses hSet/hGet instead of set/get) */
    field?: string;
    /** Expiration time in seconds */
    expirationInSec?: number;
}

/**
 * Database error with code for retry logic.
 */
export type AppError = Error & {
    code: string;
};

import { Service } from 'typedi';
import DatabaseConnection from '../connection/database';
import { AppError, MongoDb } from '../types';
import logger from '../utils/logger';

/**
 * DatabaseWrapper extends DatabaseConnection and provides query execution
 * for both MySQL and MongoDB, with auto-retry on transient errors.
 * Managed by TypeDI.
 */
@Service()
export default class DatabaseWrapper extends DatabaseConnection {
    constructor() {
        super();
    }

    // ==================== MySQL ====================

    /**
     * Execute a SQL query with auto-retry on connection errors.
     */
    public async executeSqlQuery<T>(sql: string, params: (number | string | boolean | null)[] = []): Promise<T[]> {
        const pool = this.getSqlPool();
        if (!pool) {
            logger.warn('[DatabaseWrapper] No SQL pool available');
            return [];
        }

        try {
            const [rows] = await pool.query(sql, params);
            return rows as T[];
        } catch (error) {
            const err = error as AppError;
            if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'EPIPE' || err.code === 'ECONNRESET') {
                logger.warn({ code: err.code }, '[DatabaseWrapper] Retrying SQL query after connection error');
                return this.executeSqlQuery<T>(sql, params);
            }
            throw error;
        }
    }

    // ==================== MongoDB ====================

    /**
     * Find documents in a MongoDB collection.
     */
    public async mongoFind<T>(collectionName: string, query: Record<string, unknown> = {}, options?: { limit?: number; skip?: number; sort?: Record<string, unknown> }): Promise<T[]> {
        const db = this.getMongoDb();
        if (!db) {
            logger.warn('[DatabaseWrapper] No MongoDB connection available');
            return [];
        }

        try {
            let cursor = db.collection(collectionName).find(query);
            if (options?.sort) cursor = cursor.sort(options.sort);
            if (options?.skip) cursor = cursor.skip(options.skip);
            if (options?.limit) cursor = cursor.limit(options.limit);
            const results = await cursor.toArray();
            return results as unknown as T[];
        } catch (error) {
            logger.error(error, '[DatabaseWrapper][mongoFind] Error');
            throw error;
        }
    }

    /**
     * Find a single document in a MongoDB collection.
     */
    public async mongoFindOne<T>(collectionName: string, query: Record<string, unknown>): Promise<T | null> {
        const db = this.getMongoDb();
        if (!db) {
            logger.warn('[DatabaseWrapper] No MongoDB connection available');
            return null;
        }

        try {
            const result = await db.collection(collectionName).findOne(query);
            return result as unknown as T | null;
        } catch (error) {
            logger.error(error, '[DatabaseWrapper][mongoFindOne] Error');
            throw error;
        }
    }

    /**
     * Insert a document into a MongoDB collection.
     */
    public async mongoInsertOne(collectionName: string, doc: Record<string, unknown>): Promise<{ insertedId: unknown }> {
        const db = this.getMongoDb();
        if (!db) throw new Error('[DatabaseWrapper] No MongoDB connection available');
        return db.collection(collectionName).insertOne(doc);
    }

    /**
     * Update a document in a MongoDB collection.
     */
    public async mongoUpdateOne(collectionName: string, filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ modifiedCount: number }> {
        const db = this.getMongoDb();
        if (!db) throw new Error('[DatabaseWrapper] No MongoDB connection available');
        return db.collection(collectionName).updateOne(filter, update);
    }

    /**
     * Delete a document from a MongoDB collection.
     */
    public async mongoDeleteOne(collectionName: string, filter: Record<string, unknown>): Promise<{ deletedCount: number }> {
        const db = this.getMongoDb();
        if (!db) throw new Error('[DatabaseWrapper] No MongoDB connection available');
        return db.collection(collectionName).deleteOne(filter);
    }

    /**
     * Run an aggregation pipeline on a MongoDB collection.
     */
    public async mongoAggregate<T>(collectionName: string, pipeline: Record<string, unknown>[]): Promise<T[]> {
        const db = this.getMongoDb();
        if (!db) throw new Error('[DatabaseWrapper] No MongoDB connection available');

        try {
            const results = await db.collection(collectionName).aggregate(pipeline).toArray();
            return results as unknown as T[];
        } catch (error) {
            logger.error(error, '[DatabaseWrapper][mongoAggregate] Error');
            throw error;
        }
    }

    /**
     * Get the raw MongoDB Db instance for advanced operations.
     */
    public getMongo(): MongoDb | null {
        return this.getMongoDb();
    }
}

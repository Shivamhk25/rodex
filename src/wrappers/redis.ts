import { Service } from 'typedi';
import RedisConnection from '../connection/redis';
import logger from '../utils/logger';

/**
 * RedisWrapper extends RedisConnection and provides all Redis operations.
 * Managed by TypeDI.
 */
@Service()
export default class RedisWrapper extends RedisConnection {
    constructor() {
        super();
    }

    /**
     * GET a string value by key.
     */
    public async get(key: string): Promise<string | null> {
        const client = this.connect();
        if (!client) return null;
        const data = await client.getAsync(key);
        if (!data || Object.keys(data).length === 0) return null;
        return data;
    }

    /**
     * HGET — retrieve hash fields.
     * @param fields - single field, array of fields, or null for all.
     */
    public async hGet(key: string, fields: string[] | string | null = null): Promise<{ [key: string]: string | number | boolean | null } | null> {
        const client = this.connect();
        if (!client || !key) return null;

        if (fields && Array.isArray(fields)) {
            const values = await client.hmgetAsync(key, fields);
            if (!values || values.every((v: string | null) => !v)) return null;
            return fields.reduce((acc: { [key: string]: string | null }, field, index) => {
                acc[field] = values[index];
                return acc;
            }, {});
        } else if (fields && typeof fields === 'string') {
            const data = await client.hgetAsync(key, fields);
            if (!data) return null;
            return { [fields]: data };
        } else {
            const data = await client.hgetallAsync(key);
            if (!data || Object.keys(data).length === 0) return null;
            return data;
        }
    }

    /**
     * SET a string value with optional TTL.
     */
    public async set(key: string, value: string | number | boolean | null, expirationInSec: number | null = null): Promise<void> {
        const client = this.connect();
        if (!client) return;
        if (expirationInSec) {
            await client.setAsync(key, value, 'EX', expirationInSec);
        } else {
            await client.setAsync(key, value);
        }
    }

    /**
     * HMSET — set multiple hash fields.
     */
    public async hSet(key: string, data: { [key: string]: string | number | boolean | null }, expirationInSec: number | null = null): Promise<void> {
        const client = this.connect();
        if (!client) return;
        await client.hmsetAsync(key, data);
        if (expirationInSec) {
            await client.expireAsync(key, expirationInSec);
        }
    }

    /**
     * HSET — set a single hash field.
     */
    public async hSetField(key: string, fieldName: string, data: string | number | boolean | null, expirationInSec: number | null = null): Promise<void> {
        const client = this.connect();
        if (!client) return;
        await client.hsetAsync(key, fieldName, data);
        if (expirationInSec) {
            await client.expireAsync(key, expirationInSec);
        }
    }

    /**
     * DEL — delete a key.
     */
    public async del(key: string): Promise<number> {
        const client = this.connect();
        if (!client) return 0;
        return await client.delAsync(key);
    }

    /**
     * SCAN — find keys matching a pattern.
     */
    public async scan(pattern: string, batchSize = 100): Promise<string[]> {
        const client = this.connect();
        if (!client) return [];
        let cursor = '0';
        const keys: string[] = [];
        do {
            const [nextCursor, resultKeys] = await client.scanAsync(cursor, 'MATCH', pattern, 'COUNT', batchSize);
            cursor = nextCursor;
            keys.push(...resultKeys);
        } while (cursor !== '0');
        return keys;
    }

    /**
     * UNLINK — async delete a single key.
     */
    public async unlink(key: string): Promise<number> {
        const client = this.connect();
        if (!client) return 0;
        return await client.unlinkAsync(key);
    }

    /**
     * UNLINK by pattern — async delete all matching keys.
     */
    public async unlinkByPattern(pattern: string, batchSize = 100): Promise<number> {
        const client = this.connect();
        if (!client) return 0;
        const keys = await this.scan(`*${pattern}*`, batchSize);
        if (keys.length === 0) return 0;

        const pipeline = client.batch();
        keys.forEach((key) => pipeline.unlink(key));

        return new Promise<number>((resolve) => {
            pipeline.exec((err, results) => {
                if (err) {
                    logger.warn(err, '[RedisWrapper][unlinkByPattern] Pipeline error');
                    return resolve(0);
                }
                const count = (results || []).reduce((acc: number, result: unknown) => {
                    return acc + (typeof result === 'number' ? result : 0);
                }, 0);
                resolve(count);
            });
        });
    }

    /**
     * HDEL — delete one or more hash fields.
     */
    public async hDel(key: string, fields: string | string[]): Promise<number> {
        const client = this.connect();
        if (!client) return 0;
        const fieldsToDelete = Array.isArray(fields) ? fields : [fields];
        if (fieldsToDelete.length === 0) return 0;
        return await client.hdelAsync(key, ...fieldsToDelete);
    }
}

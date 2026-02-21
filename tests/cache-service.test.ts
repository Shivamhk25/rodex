/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

jest.mock('typedi', () => {
    const containerStore = new Map<string, unknown>();
    return {
        Service: () => (target: any) => target,
        Inject: () => () => undefined,
        Container: {
            set: (key: string, value: unknown) => containerStore.set(key, value),
            get: (target: any) => new target(),
        },
    };
});

import CacheService from '../src/services/cache';
import RedisWrapper from '../src/wrappers/redis';
import DatabaseWrapper from '../src/wrappers/database';

const createMockRedis = (): jest.Mocked<RedisWrapper> =>
    ({
        get: jest.fn(),
        set: jest.fn(),
        hGet: jest.fn(),
        hSet: jest.fn(),
        hSetField: jest.fn(),
        hDel: jest.fn(),
        del: jest.fn(),
        scan: jest.fn(),
        unlink: jest.fn(),
        unlinkByPattern: jest.fn(),
        quit: jest.fn(),
        setEnabled: jest.fn(),
        isEnabled: jest.fn().mockReturnValue(true),
        connect: jest.fn(),
    } as unknown as jest.Mocked<RedisWrapper>);

const createMockDb = (): jest.Mocked<DatabaseWrapper> =>
    ({
        executeSqlQuery: jest.fn(),
        mongoFind: jest.fn(),
        mongoFindOne: jest.fn(),
        getMongoDb: jest.fn(),
        getSqlPool: jest.fn(),
    } as unknown as jest.Mocked<DatabaseWrapper>);

describe('CacheService', () => {
    let cacheService: CacheService;
    let mockRedis: jest.Mocked<RedisWrapper>;
    let mockDb: jest.Mocked<DatabaseWrapper>;

    beforeEach(() => {
        mockRedis = createMockRedis();
        mockDb = createMockDb();
        cacheService = new CacheService(mockRedis, mockDb);
    });

    describe('getCached (SQL)', () => {
        it('should return cached data on cache hit', async () => {
            const cachedData = [{ id: 1, name: 'User' }];
            mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

            const result = await cacheService.getCached({ key: 'user:1', expirationInSec: 3600 }, 'SELECT * FROM users WHERE id = ?', [1]);

            expect(result).toEqual(cachedData);
            expect(mockDb.executeSqlQuery).not.toHaveBeenCalled();
        });

        it('should return cached data from hash field', async () => {
            const cachedData = [{ id: 1, name: 'User' }];
            mockRedis.hGet.mockResolvedValue({ info: JSON.stringify(cachedData) });

            const result = await cacheService.getCached({ key: 'user:1', field: 'info', expirationInSec: 3600 }, 'SELECT * FROM users WHERE id = ?', [1]);

            expect(result).toEqual(cachedData);
            expect(mockDb.executeSqlQuery).not.toHaveBeenCalled();
        });

        it('should query DB on cache miss and cache result', async () => {
            const dbData = [{ id: 1, name: 'User' }];
            mockRedis.get.mockResolvedValue(null);
            mockDb.executeSqlQuery.mockResolvedValue(dbData);

            const result = await cacheService.getCached({ key: 'user:1', expirationInSec: 3600 }, 'SELECT * FROM users WHERE id = ?', [1]);

            expect(result).toEqual(dbData);
            expect(mockDb.executeSqlQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);

            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(mockRedis.set).toHaveBeenCalledWith('user:1', JSON.stringify(dbData), 3600);
        });

        it('should not cache empty results', async () => {
            mockRedis.get.mockResolvedValue(null);
            mockDb.executeSqlQuery.mockResolvedValue([]);

            await cacheService.getCached({ key: 'user:999' }, 'SELECT * FROM users WHERE id = ?', [999]);

            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(mockRedis.set).not.toHaveBeenCalled();
        });

        it('should fallback to DB on Redis error', async () => {
            const dbData = [{ id: 1 }];
            mockRedis.get.mockRejectedValue(new Error('Redis down'));
            mockDb.executeSqlQuery.mockResolvedValue(dbData);

            const result = await cacheService.getCached({ key: 'user:1' }, 'SELECT * FROM users WHERE id = ?', [1]);
            expect(result).toEqual(dbData);
        });
    });

    describe('getCachedOne (SQL)', () => {
        it('should return first result', async () => {
            const cachedData = [{ id: 1, name: 'User' }];
            mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

            const result = await cacheService.getCachedOne({ key: 'user:1' }, 'SELECT * FROM users WHERE id = ?', [1]);
            expect(result).toEqual({ id: 1, name: 'User' });
        });

        it('should return null when no results', async () => {
            mockRedis.get.mockResolvedValue(null);
            mockDb.executeSqlQuery.mockResolvedValue([]);

            const result = await cacheService.getCachedOne({ key: 'user:1' }, 'SELECT * FROM users WHERE id = ?', [999]);
            expect(result).toBeNull();
        });
    });

    describe('getCachedMongo', () => {
        it('should return cached data on hit', async () => {
            const cachedData = [{ _id: 1, name: 'MongoUser' }];
            mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

            const result = await cacheService.getCachedMongo({ key: 'mongo:user:1' }, 'users', { active: true });
            expect(result).toEqual(cachedData);
            expect(mockDb.mongoFind).not.toHaveBeenCalled();
        });

        it('should query MongoDB on cache miss', async () => {
            const dbData = [{ _id: 1, name: 'MongoUser' }];
            mockRedis.get.mockResolvedValue(null);
            mockDb.mongoFind.mockResolvedValue(dbData);

            const result = await cacheService.getCachedMongo({ key: 'mongo:user:1', expirationInSec: 1800 }, 'users', { active: true });
            expect(result).toEqual(dbData);
            expect(mockDb.mongoFind).toHaveBeenCalledWith('users', { active: true }, undefined);
        });
    });

    describe('invalidate', () => {
        it('should delete a key', async () => {
            await cacheService.invalidate('user:1');
            expect(mockRedis.del).toHaveBeenCalledWith('user:1');
        });

        it('should delete a hash field', async () => {
            await cacheService.invalidate('user:1', 'info');
            expect(mockRedis.hDel).toHaveBeenCalledWith('user:1', 'info');
        });
    });

    describe('invalidateByPattern', () => {
        it('should unlink by pattern', async () => {
            mockRedis.unlinkByPattern.mockResolvedValue(5);
            const result = await cacheService.invalidateByPattern('user:*');
            expect(result).toBe(5);
        });
    });
});

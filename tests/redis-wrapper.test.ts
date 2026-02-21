/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

// Mock typedi before importing anything
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

import RedisWrapper from '../src/wrappers/redis';

// Mock Redis client
const createMockRedisClient = () => ({
    getAsync: jest.fn(),
    setAsync: jest.fn(),
    delAsync: jest.fn(),
    hgetAsync: jest.fn(),
    hdelAsync: jest.fn(),
    hgetallAsync: jest.fn(),
    hmgetAsync: jest.fn(),
    hmsetAsync: jest.fn(),
    hsetAsync: jest.fn(),
    expireAsync: jest.fn(),
    scanAsync: jest.fn(),
    unlinkAsync: jest.fn(),
    quitAsync: jest.fn(),
    batch: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
});

describe('RedisWrapper', () => {
    let wrapper: RedisWrapper;
    let mockClient: ReturnType<typeof createMockRedisClient>;

    beforeEach(() => {
        mockClient = createMockRedisClient();
        wrapper = new RedisWrapper();
        // Manually inject the client (bypassing TypeDI in tests)
        (wrapper as any).client = mockClient;
        (wrapper as any).enabled = true;
    });

    describe('get', () => {
        it('should return value from Redis', async () => {
            mockClient.getAsync.mockResolvedValue('test-value');
            const result = await wrapper.get('test-key');
            expect(result).toBe('test-value');
            expect(mockClient.getAsync).toHaveBeenCalledWith('test-key');
        });

        it('should return null when disabled', async () => {
            wrapper.setEnabled(false);
            const result = await wrapper.get('test-key');
            expect(result).toBeNull();
        });

        it('should return null when no data', async () => {
            mockClient.getAsync.mockResolvedValue(null);
            const result = await wrapper.get('test-key');
            expect(result).toBeNull();
        });
    });

    describe('set', () => {
        it('should set value without expiration', async () => {
            await wrapper.set('key', 'value');
            expect(mockClient.setAsync).toHaveBeenCalledWith('key', 'value');
        });

        it('should set value with expiration', async () => {
            await wrapper.set('key', 'value', 3600);
            expect(mockClient.setAsync).toHaveBeenCalledWith('key', 'value', 'EX', 3600);
        });

        it('should do nothing when disabled', async () => {
            wrapper.setEnabled(false);
            await wrapper.set('key', 'value');
            expect(mockClient.setAsync).not.toHaveBeenCalled();
        });
    });

    describe('hGet', () => {
        it('should get all fields when no fields specified', async () => {
            mockClient.hgetallAsync.mockResolvedValue({ name: 'test', age: '25' });
            const result = await wrapper.hGet('key');
            expect(result).toEqual({ name: 'test', age: '25' });
        });

        it('should get a single field', async () => {
            mockClient.hgetAsync.mockResolvedValue('test');
            const result = await wrapper.hGet('key', 'name');
            expect(result).toEqual({ name: 'test' });
        });

        it('should get multiple fields', async () => {
            mockClient.hmgetAsync.mockResolvedValue(['val1', 'val2']);
            const result = await wrapper.hGet('key', ['field1', 'field2']);
            expect(result).toEqual({ field1: 'val1', field2: 'val2' });
        });

        it('should return null when all hmget values are null', async () => {
            mockClient.hmgetAsync.mockResolvedValue([null, null]);
            const result = await wrapper.hGet('key', ['field1', 'field2']);
            expect(result).toBeNull();
        });
    });

    describe('hSet', () => {
        it('should set hash fields', async () => {
            await wrapper.hSet('key', { name: 'test' });
            expect(mockClient.hmsetAsync).toHaveBeenCalledWith('key', { name: 'test' });
        });

        it('should set hash fields with expiration', async () => {
            await wrapper.hSet('key', { name: 'test' }, 3600);
            expect(mockClient.hmsetAsync).toHaveBeenCalledWith('key', { name: 'test' });
            expect(mockClient.expireAsync).toHaveBeenCalledWith('key', 3600);
        });
    });

    describe('del', () => {
        it('should delete a key', async () => {
            mockClient.delAsync.mockResolvedValue(1);
            const result = await wrapper.del('key');
            expect(result).toBe(1);
        });

        it('should return 0 when disabled', async () => {
            wrapper.setEnabled(false);
            const result = await wrapper.del('key');
            expect(result).toBe(0);
        });
    });

    describe('hDel', () => {
        it('should delete hash fields', async () => {
            mockClient.hdelAsync.mockResolvedValue(2);
            const result = await wrapper.hDel('key', ['field1', 'field2']);
            expect(result).toBe(2);
            expect(mockClient.hdelAsync).toHaveBeenCalledWith('key', 'field1', 'field2');
        });
    });

    describe('scan', () => {
        it('should scan and return all matching keys', async () => {
            mockClient.scanAsync.mockResolvedValueOnce(['5', ['key1', 'key2']]).mockResolvedValueOnce(['0', ['key3']]);
            const result = await wrapper.scan('user:*');
            expect(result).toEqual(['key1', 'key2', 'key3']);
        });
    });

    describe('unlink', () => {
        it('should unlink a key', async () => {
            mockClient.unlinkAsync.mockResolvedValue(1);
            const result = await wrapper.unlink('key');
            expect(result).toBe(1);
        });
    });
});

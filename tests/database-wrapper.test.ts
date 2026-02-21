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

import DatabaseWrapper from '../src/wrappers/database';

const createMockPool = () => ({
    query: jest.fn(),
    getConnection: jest.fn(),
});

describe('DatabaseWrapper', () => {
    let wrapper: DatabaseWrapper;
    let mockPool: ReturnType<typeof createMockPool>;

    beforeEach(() => {
        mockPool = createMockPool();
        wrapper = new DatabaseWrapper();
        // Manually inject pool (bypassing TypeDI)
        (wrapper as any).sqlPool = mockPool;
    });

    describe('executeSqlQuery', () => {
        it('should execute a query and return rows', async () => {
            const mockRows = [{ id: 1, name: 'Test' }];
            mockPool.query.mockResolvedValue([mockRows, []]);

            const result = await wrapper.executeSqlQuery<{ id: number; name: string }>('SELECT * FROM users WHERE id = ?', [1]);
            expect(result).toEqual(mockRows);
            expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
        });

        it('should return empty array when no pool', async () => {
            (wrapper as any).sqlPool = null;
            const result = await wrapper.executeSqlQuery('SELECT 1');
            expect(result).toEqual([]);
        });

        it('should retry on PROTOCOL_CONNECTION_LOST', async () => {
            const error = new Error('Connection lost') as Error & { code: string };
            error.code = 'PROTOCOL_CONNECTION_LOST';

            const mockRows = [{ id: 1 }];
            mockPool.query.mockRejectedValueOnce(error).mockResolvedValueOnce([mockRows, []]);

            const result = await wrapper.executeSqlQuery('SELECT 1');
            expect(result).toEqual(mockRows);
            expect(mockPool.query).toHaveBeenCalledTimes(2);
        });

        it('should retry on EPIPE', async () => {
            const error = new Error('Broken pipe') as Error & { code: string };
            error.code = 'EPIPE';

            const mockRows = [{ id: 1 }];
            mockPool.query.mockRejectedValueOnce(error).mockResolvedValueOnce([mockRows, []]);

            const result = await wrapper.executeSqlQuery('SELECT 1');
            expect(result).toEqual(mockRows);
        });

        it('should throw on non-retryable errors', async () => {
            const error = new Error('Syntax error');
            mockPool.query.mockRejectedValue(error);
            await expect(wrapper.executeSqlQuery('INVALID SQL')).rejects.toThrow('Syntax error');
        });
    });

    describe('MongoDB operations', () => {
        const mockCollection = {
            find: jest.fn(),
            findOne: jest.fn(),
            insertOne: jest.fn(),
            updateOne: jest.fn(),
            deleteOne: jest.fn(),
            aggregate: jest.fn(),
        };

        const mockMongoDb = {
            collection: jest.fn().mockReturnValue(mockCollection),
        };

        beforeEach(() => {
            (wrapper as any).mongoDb = mockMongoDb;
        });

        it('should find documents', async () => {
            const mockCursor = { toArray: jest.fn().mockResolvedValue([{ _id: 1 }]), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis() };
            mockCollection.find.mockReturnValue(mockCursor);

            const result = await wrapper.mongoFind('users', { active: true });
            expect(result).toEqual([{ _id: 1 }]);
            expect(mockMongoDb.collection).toHaveBeenCalledWith('users');
        });

        it('should find one document', async () => {
            mockCollection.findOne.mockResolvedValue({ _id: 1, name: 'Test' });
            const result = await wrapper.mongoFindOne('users', { _id: 1 });
            expect(result).toEqual({ _id: 1, name: 'Test' });
        });

        it('should insert a document', async () => {
            mockCollection.insertOne.mockResolvedValue({ insertedId: 'abc' });
            const result = await wrapper.mongoInsertOne('users', { name: 'New' });
            expect(result).toEqual({ insertedId: 'abc' });
        });

        it('should return null mongoFindOne when no mongo', async () => {
            (wrapper as any).mongoDb = null;
            const result = await wrapper.mongoFindOne('users', { _id: 1 });
            expect(result).toBeNull();
        });
    });
});

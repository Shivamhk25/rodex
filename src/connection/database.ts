import { Service, Inject } from 'typedi';
import { Pool } from 'mysql2/promise';
import { ContainerToken } from '../config';
import { MongoDb } from '../types';
import logger from '../utils/logger';

@Service()
export default class DatabaseConnection {
    @Inject(ContainerToken.SQL_POOL)
    private sqlPool: Pool | null = null;

    @Inject(ContainerToken.MONGO_DB)
    private mongoDb: MongoDb | null = null;

    /**
     * Returns the MySQL connection pool.
     */
    public getSqlPool(): Pool | null {
        return this.sqlPool;
    }

    /**
     * Returns the MongoDB Db instance.
     */
    public getMongoDb(): MongoDb | null {
        return this.mongoDb;
    }

    /**
     * Verifies the SQL pool connection is alive.
     */
    public async verifySqlConnection(): Promise<boolean> {
        if (!this.sqlPool) return false;
        try {
            const connection = await this.sqlPool.getConnection();
            connection.release();
            return true;
        } catch (err) {
            logger.error(err, '[rodex] SQL pool connection failed');
            return false;
        }
    }
}

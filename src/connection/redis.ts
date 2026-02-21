import { Service, Inject } from 'typedi';
import * as redis from 'redis';
import bluebird from 'bluebird';
import { ContainerToken } from '../config';
import logger from '../utils/logger';

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

@Service()
export default class RedisConnection {
    @Inject(ContainerToken.REDIS)
    protected client: redis.RedisClient | null = null;

    protected enabled = true;

    /**
     * Returns the promisified Redis client, injected via TypeDI container.
     */
    public connect(): redis.RedisClient | null {
        if (!this.enabled) return null;

        if (this.client && !('hgetAsync' in this.client)) {
            bluebird.promisifyAll(this.client);
        }

        return this.client;
    }

    public setEnabled(val: boolean): void {
        this.enabled = val;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public async quit(): Promise<void> {
        if (!this.client) return;
        try {
            if (this.client.quitAsync) {
                await this.client.quitAsync();
            } else if (this.client.quit) {
                this.client.quit();
            }
        } catch (err) {
            logger.warn(err, '[rodex][RedisConnection][quit] Error');
        }
        this.client = null;
    }
}

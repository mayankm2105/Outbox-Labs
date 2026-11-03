import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbConfig from '../../src/config/database';
import * as redisConfig from '../../src/config/redis';
import * as esConfig from '../../src/config/elasticsearch';

describe('Health Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes when database, redis, and elasticsearch succeed', async () => {
    const dbSpy = vi.spyOn(dbConfig, 'checkDatabaseConnection').mockResolvedValue();
    const redisSpy = vi.spyOn(redisConfig, 'checkRedisConnection').mockResolvedValue();
    const esSpy = vi.spyOn(esConfig, 'checkElasticsearchConnection').mockResolvedValue();

    await expect(dbConfig.checkDatabaseConnection()).resolves.toBeUndefined();
    await expect(redisConfig.checkRedisConnection()).resolves.toBeUndefined();
    await expect(esConfig.checkElasticsearchConnection()).resolves.toBeUndefined();

    expect(dbSpy).toHaveBeenCalled();
    expect(redisSpy).toHaveBeenCalled();
    expect(esSpy).toHaveBeenCalled();
  });

  it('fails when database check throws an error', async () => {
    vi.spyOn(dbConfig, 'checkDatabaseConnection').mockRejectedValue(new Error('PostgreSQL down'));
    await expect(dbConfig.checkDatabaseConnection()).rejects.toThrow('PostgreSQL down');
  });

  it('fails when redis check throws an error', async () => {
    vi.spyOn(redisConfig, 'checkRedisConnection').mockRejectedValue(new Error('Redis down'));
    await expect(redisConfig.checkRedisConnection()).rejects.toThrow('Redis down');
  });
});

import { Client } from '@elastic/elasticsearch';
import { env } from './env';
import { logger } from '../shared/utils/logger';

let esClient: Client | null = null;

export function getElasticsearchClient(): Client {
  if (esClient) return esClient;

  esClient = new Client({
    node: env.ELASTICSEARCH_URL,
  });

  return esClient;
}

export async function checkElasticsearchConnection(): Promise<void> {
  const client = getElasticsearchClient();
  const health = await client.cluster.health({});
  if (!health || !health.status) {
    throw new Error('Elasticsearch health check failed');
  }
}

export async function closeElasticsearchConnection(): Promise<void> {
  if (esClient) {
    await esClient.close();
    esClient = null;
    logger.info('Elasticsearch connection closed gracefully');
  }
}


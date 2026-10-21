import { LRUCache } from 'lru-cache';

const users = new LRUCache<string, User>({
  ttlAutopurge: false,
});

const users = new LRUCache<string, User>({ max: 10_000, ttl: 30_000 });

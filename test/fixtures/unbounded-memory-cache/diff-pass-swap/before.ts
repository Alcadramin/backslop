const users = new LRUCache<string, User>({ max: 5_000, ttl: 60_000 });

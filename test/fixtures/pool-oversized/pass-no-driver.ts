// no database driver in this file: `max` is a rate limit
export const limiter = new Pool({ max: 500 });

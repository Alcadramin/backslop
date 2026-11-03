// We used to check process.env.NODE_ENV === 'test' here; the clock is injected now.
export function makeLogger(env = process.env.NODE_ENV) {
  const level = env === 'production' ? 'info' : 'debug';
  return { level, label: 'test' };
}

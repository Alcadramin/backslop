export function a() { return 1; }

export async function readConfig() {
  return JSON.parse(await fs.promises.readFile('config.json', 'utf8'));
}

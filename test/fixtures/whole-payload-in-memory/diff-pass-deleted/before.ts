export function a() { return 1; }

export async function legacyArchive(path: string) {
  await pipeline(fs.createReadStream(path), zlib.createGzip(), fs.createWriteStream(`${path}.gz`));
}

export async function archive(path: string) {
  await pipeline(fs.createReadStream(path), zlib.createGzip(), fs.createWriteStream(`${path}.gz`));
}

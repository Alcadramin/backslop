export async function archive(path: string) {
  fs.createReadStream(path).pipe(zlib.createGzip()).pipe(fs.createWriteStream(`${path}.gz`));
}

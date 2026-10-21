export async function archive(path: string) {
  const buf = await fs.promises.readFile(path);
  await fs.promises.writeFile(`${path}.gz`, zlib.gzipSync(buf));
}

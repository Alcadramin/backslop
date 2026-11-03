// A CLI entry point, not a test: exiting 0 here is normal.
export async function main() {
  await run();
  process.exit(0);
}

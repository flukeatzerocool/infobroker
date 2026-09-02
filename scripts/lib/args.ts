// args.ts — shared CLI help handling for tooling scripts.
//
// `handleHelp` prints usage to stdout and exits 0 on `--help`/`-h`, so
// scripts don't repeat the same usage block inline.

// Handle `--help`/`-h`: print usage to stdout and exit 0.
export function handleHelp(argv: string[], usage: string): boolean {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(usage);
    process.exit(0);
  }
  return false;
}

const USAGE = `Usage: kb [options]

Options:
  --version   Print the kb version
  --help      Print this help
`;

export function runCli(argv, { version, stdout }) {
  if (argv.includes('--version')) {
    stdout.write(`${version}\n`);
    return 0;
  }
  if (argv.includes('--help')) {
    stdout.write(USAGE);
    return 0;
  }
  stdout.write(USAGE);
  return 0;
}

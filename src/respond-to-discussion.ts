#!/usr/bin/env node
import minimist from 'minimist';

const respondToDiscussion = async () => {
  const argv = minimist(process.argv.slice(2));

  console.log(argv);
};

async function main(): Promise<void> {
  await respondToDiscussion();
}

main().catch((error) => {
  console.error(error);

  // Exit with non-zero code
  process.exit(1);
});

import { join } from 'path';

import { copySync } from 'fs-extra';

async function build() {
  // copy git folder to dist folder for semantic-release
  copySync('.git', join(process.cwd(), 'dist/.git'));
  // copy files to distribution folder
  copySync(
    'package.json',
    join(process.cwd(), 'dist/package.json'),
  );
  copySync('README.md', join(process.cwd(), 'dist/README.md'));
  copySync('LICENSE', join(process.cwd(), 'dist/LICENSE'));
}

build()
  .then(() => console.log('build success'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

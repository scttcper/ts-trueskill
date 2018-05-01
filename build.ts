import { join } from 'path';

import { copySync } from 'fs-extra';
import { rollup, OutputOptions, RollupFileOptions } from 'rollup';
import * as sourceMaps from 'rollup-plugin-sourcemaps';

// ESM5 input output
const moduleInputOptions: RollupFileOptions = {
  input: `dist/esm5/public_api.js`,
  external: ['tslib', 'ts-gaussian', 'mathjs', 'uuid', 'lodash'],
  plugins: [sourceMaps()],
};
const moduleOutputOptions: OutputOptions = {
  file: './dist/package-dist/bundles/ts-trueskill.es2015.js',
  format: 'es',
  globals: {
    lodash: '_',
    uuid: 'uuid',
    mathjs: 'math',
    'ts-gaussian': 'gaussian',
  },
  sourcemap: true,
};

async function build() {
  // create bundle
  const mod = await rollup(moduleInputOptions);
  await mod.write(moduleOutputOptions);

  // copy git folder to dist folder for semantic-release
  copySync('.git', join(process.cwd(), 'dist/package-dist/.git'));
  // copy files to distribution folder
  copySync(
    'package.json',
    join(process.cwd(), 'dist/package-dist/package.json'),
  );
  copySync('README.md', join(process.cwd(), 'dist/package-dist/README.md'));
  copySync('LICENSE', join(process.cwd(), 'dist/package-dist/LICENSE'));
}

build()
  .then(() => console.log('build success'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

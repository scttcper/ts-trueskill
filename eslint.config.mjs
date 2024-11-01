import config from '@ctrl/eslint-config-biome';

export default [
  {
    ignores: [
      'tailwind.config.cjs',
      'postcss.config.cjs',
      'eslint.config.mjs',
      'vite.config.ts',
      'dist',
      'coverage',
      'build',
    ],
  },
  ...config,
];

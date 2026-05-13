import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/extension.ts', 'src/test/**/*.ts'],
  project: ['src/**/*.ts'],
  ignore: ['out/**'],
  ignoreDependencies: ['@types/*'],
};

export default config;

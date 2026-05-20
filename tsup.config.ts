import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  // DTS disabled: tsup injects baseUrl="." internally which triggers a TS6 deprecation error.
  // This is a CLI binary, not a library — consumers don't need .d.ts files.
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  platform: 'node',
  shims: true,
  define: {
    '__PACKAGE_VERSION__': JSON.stringify(pkg.version),
  },
});

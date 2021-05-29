import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist'
  },
  watch: {
    include: ['src/**'],
    exclude: ['node_modules/**']
  },
  plugins: [typescript(), commonjs()],
};
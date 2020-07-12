import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'cjs',
  },
  plugins: [
    commonjs(),
    babel({
      extensions: ['.js', '.ts'],
      exclude: ['node_modules/**'],
    }),
  ],
};

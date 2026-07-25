import resolve    from '@rollup/plugin-node-resolve';
import commonjs   from '@rollup/plugin-commonjs';
import babel      from '@rollup/plugin-babel';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

const babelPlugin = babel({
  babelHelpers: 'bundled',
  presets: [
    ['@babel/preset-env', { targets: '> 0.5%, last 2 versions, not dead' }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  extensions: ['.js', '.jsx'],
  exclude: 'node_modules/**',
});

// Packages that consumers must supply — never bundled
const PEER_EXTERNALS = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^@deck\.gl\//,
  /^@luma\.gl\//,
  /^@loaders\.gl\//,
  'd3-scale',
  'd3-format',
  'd3-time-format',
  'events',
  'fft.js',
  'fft-windowing',
];

// For ui/ and loaders/ bundles: any import that reaches into src/ is already
// exported by the main 'masterplot' package — externalize it and remap the
// path so the output bundle references 'masterplot/src/...' (a deep import
// that resolves via the src/ directory included in the npm package).
//
// NOTE: Rollup passes the raw import string (not the resolved absolute path)
// to the external function for direct imports, so '../src/...' matches here.
const isSrcRelative = (id) => id.startsWith('../src/') || id.includes('/src/');
const srcPathRemapper = (id) => {
  // Remap any '../src/...' reference to '../src/...' relative to lib/
  // e.g. '../src/plot/layers/Foo.js' → '../src/plot/layers/Foo.js'
  // Absolute paths get normalized to the same relative form.
  const match = id.match(/[/\\]src[/\\](.*)/);
  return match ? `../src/${match[1]}` : id;
};

// external() function for sub-packages: combines peer externals + src remapping
const isMatch = (id, patterns) =>
  patterns.some((p) => (typeof p === 'string' ? p === id : p.test(id)));

const makeSubExternal = (...extraStrings) => (id) =>
  isSrcRelative(id) || isMatch(id, extraStrings) || isMatch(id, PEER_EXTERNALS);

// ── Main library ────────────────────────────────────────────────────────────
const mainConfig = {
  input: 'src/index.js',
  output: [
    { file: 'lib/index.cjs.js', format: 'cjs', sourcemap: true, exports: 'named' },
    { file: 'lib/index.esm.js', format: 'esm', sourcemap: true },
  ],
  plugins: [
    peerDepsExternal(),
    resolve({ extensions: ['.js', '.jsx'] }),
    commonjs(),
    babelPlugin,
  ],
  external: PEER_EXTERNALS,
};

// ── Optional UI widgets (masterplot/ui) ─────────────────────────────────────
const uiConfig = {
  input: 'ui/index.js',
  output: [
    {
      file: 'lib/ui.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      paths: srcPathRemapper,
    },
    {
      file: 'lib/ui.esm.js',
      format: 'esm',
      sourcemap: true,
      paths: srcPathRemapper,
    },
  ],
  plugins: [
    peerDepsExternal(),
    resolve({ extensions: ['.js', '.jsx'] }),
    commonjs(),
    babelPlugin,
  ],
  external: makeSubExternal(),
};

// ── Optional data loaders (masterplot/loaders) ──────────────────────────────
const loadersConfig = {
  input: 'loaders/index.js',
  output: [
    {
      file: 'lib/loaders.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      paths: srcPathRemapper,
    },
    {
      file: 'lib/loaders.esm.js',
      format: 'esm',
      sourcemap: true,
      paths: srcPathRemapper,
    },
  ],
  plugins: [
    peerDepsExternal(),
    resolve({ extensions: ['.js', '.jsx'] }),
    commonjs(),
    babelPlugin,
  ],
  external: makeSubExternal('zstd-codec'),
};

export default [mainConfig, uiConfig, loadersConfig];

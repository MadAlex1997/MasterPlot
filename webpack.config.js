const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    entry: {
      main:                  './examples/src/index.js',
      example:               './examples/src/example.js',
      'live-signals':        './examples/src/live-signals.js',
      'shared-data':         './examples/src/shared-data.js',
      seismography:          './examples/src/seismography.js',
      'multi-sensor':        './examples/src/multi-sensor.js',
      'spectrogram-popup':   './examples/src/spectrogram-popup.js',
      docs:                  './examples/src/docs.js',
      'spectrogram-v2':      './examples/src/spectrogramV2.js',
      'bitmap':              './examples/src/bitmap.js',
      'bitmap-lod':          './examples/src/bitmap-lod.js',
      'data-loaders':        './examples/src/data-loaders.js',
      'axis-showcase':       './examples/src/axis-showcase.js',
      'time-axis-showcase':  './examples/src/time-axis-showcase.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isDev ? '[name].js' : '[name].[contenthash].js',
      publicPath: isDev ? '/' : '/MasterPlot/',
      clean: true,
    },
    resolve: {
      extensions: ['.js', '.jsx'],
      alias: {
        'process/browser': path.resolve(__dirname, 'node_modules/process/browser.js'),
      },
      fallback: {
        process: path.resolve(__dirname, 'node_modules/process/browser.js'),
        // zstd-codec (Emscripten) needs these Node built-ins polyfilled in the browser
        fs:     false,                                   // zstd-codec checks for fs but doesn't truly need it in browser
        path:   require.resolve('path-browserify'),
        buffer: require.resolve('buffer/'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        vm:     require.resolve('vm-browserify'),
      },
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: { loader: 'babel-loader' },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        // Required for zstd-codec and any other Emscripten/WASM packages:
        // webpack 5 must treat .wasm files as static assets, not bundled modules
        {
          test: /\.wasm$/,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
        chunks:   ['main'],
      }),
      new HtmlWebpackPlugin({
        template: './public/example.html',
        filename: 'example.html',
        chunks:   ['example'],
      }),
      new HtmlWebpackPlugin({
        template: './public/live-signals.html',
        filename: 'live-signals.html',
        chunks:   ['live-signals'],
      }),
      new HtmlWebpackPlugin({
        template: './public/shared-data.html',
        filename: 'shared-data.html',
        chunks:   ['shared-data'],
      }),
      new HtmlWebpackPlugin({
        template: './public/seismography.html',
        filename: 'seismography.html',
        chunks:   ['seismography'],
      }),
      new HtmlWebpackPlugin({
        template: './public/multi-sensor.html',
        filename: 'multi-sensor.html',
        chunks:   ['multi-sensor'],
      }),
      new HtmlWebpackPlugin({
        template: './public/spectrogram-popup.html',
        filename: 'spectrogram-popup.html',
        chunks:   ['spectrogram-popup'],
      }),
      new HtmlWebpackPlugin({
        template: './public/docs.html',
        filename: 'docs.html',
        chunks:   ['docs'],
      }),
      new HtmlWebpackPlugin({
        template: './public/spectrogram-v2.html',
        filename: 'spectrogram-v2.html',
        chunks:   ['spectrogram-v2'],
      }),
      new HtmlWebpackPlugin({
        template: './public/bitmap.html',
        filename: 'bitmap.html',
        chunks:   ['bitmap'],
      }),
      new HtmlWebpackPlugin({
        template: './public/bitmap-lod.html',
        filename: 'bitmap-lod.html',
        chunks:   ['bitmap-lod'],
      }),
      new HtmlWebpackPlugin({
        template: './public/data-loaders.html',
        filename: 'data-loaders.html',
        chunks:   ['data-loaders'],
      }),
      new HtmlWebpackPlugin({
        template: './public/axis-showcase.html',
        filename: 'axis-showcase.html',
        chunks:   ['axis-showcase'],
      }),
      new HtmlWebpackPlugin({
        template: './public/time-axis-showcase.html',
        filename: 'time-axis-showcase.html',
        chunks:   ['time-axis-showcase'],
      }),
      new webpack.ProvidePlugin({
        process: 'process/browser',
        // Make Buffer globally available — zstd-codec and loaders.gl both need it
        Buffer: ['buffer', 'Buffer'],
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: 'sounds', to: 'sounds' }],
      }),
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
      },
      compress: true,
      port: 3000,
      hot: true,
      open: false,
    },
    devtool: isDev ? 'eval-source-map' : 'source-map',
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
    },
  };
};
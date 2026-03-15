const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    // Multi-entry: one bundle per example page
    entry: {
      main:            './examples/src/index.js',
      example:         './examples/src/example.js',
      spectrogram:     './examples/src/spectrogram.js',
      'live-signals':  './examples/src/live-signals.js',
      'shared-data':   './examples/src/shared-data.js',
      seismography:    './examples/src/seismography.js',
      'multi-sensor':        './examples/src/multi-sensor.js',
      'spectrogram-popup':   './examples/src/spectrogram-popup.js',
      docs:                  './examples/src/docs.js',
      'spectrogram-v2':      './examples/src/spectrogramV2.js',
      'bitmap':              './examples/src/bitmap.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isDev ? '[name].js' : '[name].[contenthash].js',
      publicPath: isDev ? '/' : '/MasterPlot/',
      clean: true,
    },
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
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
        template: './public/spectrogram.html',
        filename: 'spectrogram.html',
        chunks:   ['spectrogram'],
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

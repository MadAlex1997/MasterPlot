const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    // Multi-entry: one bundle per example page
    entry: {
      main:            './src/index.js',
      example:         './src/example.js',
      spectrogram:     './src/spectrogram.js',
      'live-signals':  './src/live-signals.js',
      'shared-data':   './src/shared-data.js',
      seismography:    './src/seismography.js',
      'multi-sensor':  './src/multi-sensor.js',
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

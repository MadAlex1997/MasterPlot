const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    // Multi-entry: one bundle per example page
    entry: {
      main:           './src/index.js',
      example:        './src/example.js',
      line:           './src/line.js',
      spectrogram:    './src/spectrogram.js',
      'rolling-line': './src/rolling-line.js',
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
        template: './public/line.html',
        filename: 'line.html',
        chunks:   ['line'],
      }),
      new HtmlWebpackPlugin({
        template: './public/spectrogram.html',
        filename: 'spectrogram.html',
        chunks:   ['spectrogram'],
      }),
      new HtmlWebpackPlugin({
        template: './public/rolling-line.html',
        filename: 'rolling-line.html',
        chunks:   ['rolling-line'],
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

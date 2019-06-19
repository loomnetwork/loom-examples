const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const buildPath = path.resolve(__dirname, 'dist')

module.exports = {
  entry: {
    app: ['babel-polyfill', './src/index.js'],
    ethsigning: ['babel-polyfill', './src/eth-signing.js'],
    depositwithdraweth: ['babel-polyfill', './src/deposit-withdraw-eth.js'],
    depositwithdrawerc20: ['babel-polyfill', './src/deposit-withdraw-erc20.js'],
    depositwithdrawtron: ['babel-polyfill', './src/deposit-withdraw-tron.js'],
    ethsigningportis: ['babel-polyfill', './src/eth-signing-portis.js']
  },
  output: {
    filename: '[name].[hash:20].js',
    path: buildPath
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      inject: true,
      chunks: ['index'],
      filename: 'index.html'
    }),
    new HtmlWebpackPlugin({
      template: './src/eth-signing.html',
      inject: true,
      chunks: ['ethsigning'],
      filename: 'eth-signing.html'
    }),
    new HtmlWebpackPlugin({
      template: './src/deposit-withdraw-eth.html',
      inject: true,
      chunks: ['depositwithdraweth'],
      filename: 'deposit-withdraw-eth.html'
    }),
    new HtmlWebpackPlugin({
      template: './src/deposit-withdraw-erc20.html',
      inject: true,
      chunks: ['depositwithdrawerc20'],
      filename: 'deposit-withdraw-erc20.html'
    }),
    new HtmlWebpackPlugin({
      template: './src/deposit-withdraw-tron.html',
      inject: true,
      chunks: ['depositwithdrawtron'],
      filename: 'deposit-withdraw-tron.html'
    }),
    new HtmlWebpackPlugin({
      template: './src/eth-signing-portis.html',
      inject: true,
      chunks: ['ethsigningportis'],
      filename: 'eth-signing-portis.html'
    }),
    new CleanWebpackPlugin()
  ],
  module: {
    rules: [
      {
        test: [/.js$/],
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env'
            ]
          }
        }
      },
      {
        test: [/.css$/],
        use: [
          'style-loader',
          'css-loader'
        ]
      }
    ]
  },
  node: {
    fs: 'empty',
    child_process: 'empty'
  }
}

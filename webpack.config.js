const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin   = require('clean-webpack-plugin');

module.exports = {
  entry: {
    app: ["babel-polyfill", "./src/index.js"]
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new HtmlWebpackPlugin({
        title: 'Eth Signing Demo',
        template: './src/index.html',
        inject: true,
        minify: {
            removeComments: true,
            collapseWhitespace: false
        }
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
          use:[
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
};


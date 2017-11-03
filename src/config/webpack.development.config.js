import webpack from 'webpack'
import htmlPlugin from 'html-webpack-plugin'
import path from 'path'

import base from './webpack.base'

export default Object.assign({}, base, {
  devtool: 'source-map',
  entry: {
    'app': [
      'babel-polyfill',
      'react-hot-loader/patch',
      'webpack-hot-middleware/client',
      'webpack/hot/only-dev-server',
      './src/webapp/main.js',
    ]
  },
  plugins: [
    new htmlPlugin({ template: 'public/index.html' }),
    new webpack.HotModuleReplacementPlugin()
  ]
})

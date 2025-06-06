'use strict';

const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths');

// Merge webpack configuration files
const config = merge(common, {
  entry: {
    //react
    popup: PATHS.src + '/js/popup.jsx',
    dashboard: PATHS.src + '/js/dashboard.jsx',
    settings: PATHS.src + '/js/settings.jsx',

    //javascript
    contentScript: PATHS.src + '/js/contentScript.js',
    background: PATHS.src + '/js/background.js',
    injected: PATHS.src + '/js/injected.js',
  },
});

module.exports = config;

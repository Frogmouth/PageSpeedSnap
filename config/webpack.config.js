"use strict";

const { merge } = require("webpack-merge");

const common = require("./webpack.common.js");
const PATHS = require("./paths");

// Merge webpack configuration files
const config = merge(common, {
  entry: {
    //react
    popup: PATHS.src + "/js/popup.jsx",
    dashboard: PATHS.src + "/js/dashboard.jsx",
    settings: PATHS.src + "/js/settings.jsx",
    background: PATHS.src + "/js/background.jsx",
    mutator: PATHS.src + "/js/mutator.jsx",

    //javascript
    contentScript: PATHS.src + "/js/contentScript.js",
    injected: PATHS.src + "/js/injected.js",
  },
});

module.exports = config;

webpack = require("webpack");

module.exports = {
  entry: './src/index.js',
  output: {
    filename: "./client/dist/webAtom.js",
    libraryTarget: "var",
    library: "webAtom"
  }
}

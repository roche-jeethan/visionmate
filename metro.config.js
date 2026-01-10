const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// This tells Metro to ignore the backend folder completely
config.resolver.blockList = [
  /.*\/backend\/.*/,
];

module.exports = config;
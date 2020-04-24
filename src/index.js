const path = require('path');
const Cache = require('./redisCache');

module.exports = function nuxtComponentCache(options) {
    if (this.options.render.ssr === false) return;

    //TODO remove cache when restart

    this.addPlugin({
      src: path.resolve(__dirname, 'plugin.js'),
      fileName: 'cache.js',
      mode: 'server',
      options
    })

    if (typeof this.options.render.bundleRenderer !== 'object' || this.options.render.bundleRenderer === null)
        this.options.render.bundleRenderer = {}

    // Disable if cache explicitly provided in project
    if (this.options.render.bundleRenderer.cache) return;
    this.options.render.bundleRenderer.cache = Cache(options)
}

module.exports.meta = require('../package.json')

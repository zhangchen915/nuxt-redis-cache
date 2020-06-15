const path = require('path');
const LRU = require("lru-cache")
const Cache = require('./cache');

function cleanIfNewVersion(cache, version, prefix) {
  if (!version) return;
  return cache.redis.get(`${prefix}:version`)
    .then(oldVersion => {
      console.log(oldVersion)
      if (!oldVersion || oldVersion == version) return;
      console.log(`Cache has updated from ${oldVersion} to ${version}`);
      return cache.clean();
    });
}

function tryStoreVersion(cache, version, prefix) {
  if (!version || cache.versionSaved) return;
  return cache.redis.set(`${prefix}:version`, version)
    .then(() => cache.versionSaved = true);
}

module.exports = async function (options) {
  const {render} = this.options
  //|| process.env.NODE_ENV !== 'production'
  if (render.ssr === false) return;
  const {version = '', pages, isCacheable, prefix = '', usePathName = true, componentCache =false, cleanOldVersion} = options
  const cache = await Cache(options)
  const lruCache = new LRU(options)

  this.addPlugin({
    src: path.resolve(__dirname, 'plugin.js'),
    fileName: 'nuxt-cache.js',
    mode: 'server',
    options
  })

  if(componentCache && componentCache > 0){
    if (typeof render.bundleRenderer !== 'object' || render.bundleRenderer === null)
      render.bundleRenderer = {}

    // Disable if cache explicitly provided in project
    if (!render.bundleRenderer.cache) render.bundleRenderer.cache = lruCache
  }


  if(cleanOldVersion) cleanIfNewVersion(cache, version, prefix);

  const renderer = this.nuxt.renderer;
  const renderRoute = renderer.renderRoute.bind(renderer);
  renderer.renderRoute = function (route, context) {
    context.__redisCache= cache

    if (!Array.isArray(pages) || !pages.length || !renderer) return renderRoute(route, context);

    function isCacheFriendly(path, context) {
      if (typeof (isCacheable) === 'function') return isCacheable(path, context);
      return !context.res.spa && pages.some(pat =>
        pat instanceof RegExp
          ? pat.test(path)
          : path.startsWith(pat)
      );
    }

    function cacheKeyBuilder(route, context) {
      const {headers = {}, url, _parsedUrl} = context.req
      const realUrl = headers.host + url;
      if (!realUrl) return;
      const cacheKey = usePathName && realUrl
        ? _parsedUrl.pathname
        : realUrl;

      if (isCacheFriendly(cacheKey, context)) return cacheKey;
    }
    // hopefully cache reset is finished up to this point.
    if(cleanOldVersion) tryStoreVersion(cache, version, prefix);

    const cacheKey = cacheKeyBuilder(route, context);
    return renderRoute(route, context)
      .then(result => {
        if (!result.error && cacheKey) cache.set(cacheKey, JSON.stringify(result));
        return result;
      });
  };

  return cache;
}

module.exports.meta = require('../package.json')

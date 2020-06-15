const Redis = require("ioredis");
const options = <%= JSON.stringify(options) %>;

const {prefix = ''} = options;

export default ({app, $axios}, inject) => {
  const cache = app.context.ssrContext.__redisCache
  if (!$axios || !cache) return;

  $axios.$_get = $axios.$get;
  $axios.$get = async (url, config) =>{
    if (config && config.cache) {
      let cacheKey = '';
      try {
        cacheKey = `${prefix}:${url}${JSON.stringify(config.params)}`
      } catch (e) {
        console.error('cacheKey parse error', e)
      }

      if (cacheKey && await cache.has(cacheKey)) {
        return cache.get(cacheKey).then(res => {
          try {
            return JSON.parse(res)
          } catch (e) {
            return {}
          }
        });
      } else {
        return $axios.$_get(url, config).then(res => {
          try {
            cache.set(cacheKey, JSON.stringify(res), 'EX', isNaN(config.cache) ? config.cache : 60)
          } catch (e) {
          }
          return res
        })
      }

    } else {
      return $axios.$_get(url, config)
    }
  }
}

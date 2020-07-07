const Redis = require("ioredis");
const options = <%= JSON.stringify(options) %>;

const {prefix = ''} = options;

export default ({app, $axios}, inject) => {
  const redisCache = app.context.ssrContext.__redisCache
  if (!$axios || !redisCache) return;

  $axios.$_get = $axios.$get;
  $axios.$get = async (url, config) =>{
    const {cache, params} = config || {}
    let cacheKey = '';
    let ttl = isNaN(cache) ? cache : 60
    if (typeof cache === 'function') {
      try {
         const {key, cacheTime} = cache(config)
         cacheKey = key
         ttl = cacheTime
      } catch (e) {
        console.error(e)
      }
    }else{
      try {
        cacheKey = `${prefix}:${url}${JSON.stringify(params)}`
      } catch (e) {
        console.error('cacheKey parse error', e)
      }
    }

    if(!cache || !cacheKey) return $axios.$_get(url, config)
    if (await redisCache.has(cacheKey)) {
      return redisCache.get(cacheKey).then(res => {
        try {
          return JSON.parse(res)
        } catch (e) {
          return {}
        }
      });
    } else {
      return $axios.$_get(url, config).then(res => {
        try {
          redisCache.set(cacheKey, JSON.stringify(res), 'EX', ttl)
        } catch (e) {
        }
        return res
      })
    }
  }
}

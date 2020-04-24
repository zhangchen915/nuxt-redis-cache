const Redis = require("ioredis");

module.exports = function (options) {
  const {prefix = '', redisOptions, cacheTime = 60} = options;
  const redis = new Redis(redisOptions);

  return {
    set: (k, v) => {
      try {
        console.log(Array.from(v.components))
        redis.set(`${prefix}:${k}`, JSON.stringify(v), 'EX', cacheTime)
      } catch (e) {
        return console.error(e)
      }
    },
    get: (k, cb) => redis.get(`${prefix}:${k}`).then(res => {
      try {
        res = JSON.parse(res)
        res.components = [] // see https://github.com/vuejs/vue/issues/7595
      } catch (e) {
        return console.error(e)
      }
      cb(res)
      return res;
    }),
    has: (k, cb) => redis.exists(`${prefix}:${k}`).then(res => cb(res === 1)),
  }
}

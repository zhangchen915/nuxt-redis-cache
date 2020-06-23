const Redis = require("ioredis");
const Codis = require("./codis")

module.exports = async function (options) {
  const {prefix = '', redisOptions, cacheTime = 60, codisOptions, version = ''} = options;
  let redis

  if (codisOptions) {
    redis = await new Promise((resolve, reject) => {
      const codis = new Codis(codisOptions)
      codis.on('ready', client => resolve(client))
      codis.on('error', () => resolve(false))
      setTimeout(() => {
        console.error('Codis connect time out!')
        resolve(false)
      }, 5000)
    })
  } else if(redisOptions) {
    redis = new Redis(redisOptions);
  } else throw new Error('Redis config is empty!')

  if(!redis) return

  return {
    redis,
    set: (k, v) => {
      try {
        redis.set(`${prefix}:${version}:${k}`, JSON.stringify(v), 'EX', cacheTime)
      } catch (e) {
        return console.error(e)
      }
    },
    get: (k, cb) => redis.get(`${prefix}:${version}:${k}`).then(res => {
      try {
        res = JSON.parse(res)
      } catch (e) {
        return console.error(e)
      }
      if (cb) cb(res)
      return res;
    }),
    has: (k, cb) => redis.exists(`${prefix}:${version}:${k}`).then(res => {
      res = res === 1
      if (cb) cb(res)
      return res;
    }),
    clean: (match) => {
      const stream = redis.scanStream({match: match || `${prefix}:${version}`});
      stream.on('data', keys => {
        if (!keys.length) return
        const pipeline = redis.pipeline();
        keys.forEach(function (key) {
          pipeline.del(key);
        });
        pipeline.exec();
      });
      return new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('"error"', reject);
      })
    }
  }
}

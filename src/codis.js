const Zookeeper = require('zookeeper-cluster-client')
const Redis = require('ioredis')
const EventEmitter = require('events')

class Codis extends EventEmitter {
  constructor(options) {
    super(options)
    const {serverUrl, path, password ,db =0 } = options
    this._zkAddr = serverUrl
    this._proxyPath = path
    this._password = password
    this._db = db
    this._zk = Zookeeper.createClient(this._zkAddr)
    this._connPoolIndex = -1
    this._connPool = []
    this._initFromZK()
  }

  _getConnectInfo(addr) {
    if (typeof addr !== 'string' || addr.indexOf(':') < 0) return
    const [host, port] = addr.split(':')
    return {host, port}
  }

  _initFromZK() {
    this._connPool = []
    this._zk.connect()

    this._zk.once('connected', async () => {
      console.log('zk connected')
      const proxyNameList = await this._zk.getChildren(this._proxyPath, this._watcher)

      for (let proxy of proxyNameList) {
        const proxyInfo = await this._zk.getData(`${this._proxyPath}/${proxy}`, this._watcher)
        console.log(proxyInfo.toString())
        const data = JSON.parse(proxyInfo.toString())
        if (data['state'] === 'online') {
          const {port, host} = this._getConnectInfo(data['addr'])
          this._connPool.push(new Redis(port, host, {password: this._password, db: this._db}))
        }
      }
      this.emit('ready', this._getProxy())
    })
  }

  _getProxy() {
    this._connPoolIndex += 1
    const len = this._connPool.length
    if (this._connPoolIndex >= len) this._connPoolIndex = 0
    if (len !== 0) return this._connPool[this._connPoolIndex]
  }

  _watcher(event) {
    const {type, state, path} = event
    console.log(`type: ${type} || state: ${state}`)
    if (type === 'SESSION' && state === 'CONNECTING') {

    } else if (type === 'SESSION' && state === 'EXPIRED_SESSION') {
      this._zk.close()
    } else if (['CREATED', 'DELETED', 'CHANGED', 'CHILD'].includes(type) && state === 'CONNECTED') {
      this._initFromZK()
    } else {
      console.error("zookeeper connection state changed but not implemented: event:%s state:%s path:%s" % (type, state, path))
    }
  }

  getResource() {
    return this._getProxy()
  }

  close() {
    try {
      this._zk.close()
    } catch (err) {
      console.error(err)
    }
  }
}

module.exports = Codis

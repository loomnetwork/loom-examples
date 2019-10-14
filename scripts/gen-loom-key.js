const { CryptoUtils } = require('loom-js')
const fs = require('fs')

const privateKey = CryptoUtils.generatePrivateKey()
const privateKeyString = CryptoUtils.Uint8ArrayToB64(privateKey)
fs.writeFileSync('./loom/loom_private_key', privateKeyString)

const {CryptoUtils} = require('loom-js')
const fs = require('fs')

const privateKey = CryptoUtils.generatePrivateKey()
const privateKeyString = CryptoUtils.Uint8ArrayToB64(privateKey)
fs.writeFileSync('./truffle/loom-private-key', privateKeyString)

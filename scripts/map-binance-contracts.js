const {
  Client, NonceTxMiddleware, SignedTxMiddleware, Address, LocalAddress, CryptoUtils, LoomProvider,
  Contracts, soliditySha3, BinanceSigner
} = require('loom-js')

const ethers = require('ethers')

const fs = require('fs')
const Web3 = require('web3')
const path = require('path')
const bep2Token = require('../truffle/build/contracts/SampleBEP2Token.json')
const extdevChainId = 'extdev-plasma-us1'
const BinanceTransferGateway = Contracts.BinanceTransferGateway

function loadExtdevAccount () {
  const privateKeyStr = fs.readFileSync(path.join(__dirname, '../truffle/loom_private_key'), 'utf-8')
  const privateKey = CryptoUtils.B64ToUint8Array(privateKeyStr)
  const publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
  const client = new Client(
    extdevChainId,
    'wss://extdev-plasma-us1.dappchains.com/websocket',
    'wss://extdev-plasma-us1.dappchains.com/queryws'
  )
  client.txMiddleware = [
    new NonceTxMiddleware(publicKey, client),
    new SignedTxMiddleware(privateKey)
  ]
  client.on('error', msg => {
    console.error('PlasmaChain connection error', msg)
  })

  return {
    account: LocalAddress.fromPublicKey(publicKey).toString(),
    web3js: new Web3(new LoomProvider(client, privateKey)),
    client
  }
}

function getBinancePrivateKey () {
  const privateKeyStr = fs.readFileSync(path.join(__dirname, '../binance/private-key.txt'), 'utf-8')
  return privateKeyStr
}

function getBinanceTokenName () {
  const binanceTokenName = fs.readFileSync(path.join(__dirname, '../binance/binance-token-name.txt'), 'utf-8')
  return binanceTokenName
}

async function addContractMapping (client, signer, tokenExtdevAddress, ownerExtdevAddress, binanceTokenName) {
  console.log('tokenExtdevAddress: ' + tokenExtdevAddress)
  console.log('ownerExtdevAddress: ' + ownerExtdevAddress)
  console.log('binanceTokenName: ' + binanceTokenName)
  const ownerExtdevAddr = Address.fromString(`${client.chainId}:${ownerExtdevAddress}`)
  const gatewayContract = await BinanceTransferGateway.createAsync(client, ownerExtdevAddr)
  const binanceTokenAddress = ethers.utils.hexZeroPad('0x' + Buffer.from(binanceTokenName, 'utf8').toString('hex'), 20)
  const msg = binanceTokenAddress + tokenExtdevAddress.slice(2)
  const foreignContractCreatorSig = await signer.signAsync(msg)
  const localContract = Address.fromString(`${client.chainId}:${tokenExtdevAddress}`)
  const foreignContract = Address.fromString(`binance:${binanceTokenAddress}`)
  const foreignContractCreatorTxHash = null
  try {
    await gatewayContract.addContractMappingAsync({
      localContract,
      foreignContract,
      foreignContractCreatorSig,
      foreignContractCreatorTxHash })
  } catch (error) {
    console.log(error.message)
    client.disconnect()
  }
}

async function mapContracts () {
  console.log('Mapping contracts')
  const extdev = loadExtdevAccount()
  const client = extdev.client
  console.log(client.chainId)
  const binancePrivateKey = getBinancePrivateKey()
  console.log('binancePrivateKey:' + binancePrivateKey)
  const signer = new BinanceSigner(binancePrivateKey)
  const binanceTokenName = getBinanceTokenName()
  const extdevNetworkId = await extdev.web3js.eth.net.getId()
  const tokenExtdevAddress = bep2Token.networks[extdevNetworkId].address
  await addContractMapping(client, signer, tokenExtdevAddress, extdev.account, binanceTokenName)
  client.disconnect()
}

mapContracts()



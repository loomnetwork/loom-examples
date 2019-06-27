const {
  Client, NonceTxMiddleware, SignedTxMiddleware, Address, LocalAddress, CryptoUtils, LoomProvider,
  Contracts, soliditySha3
} = require('loom-js')
const fs = require('fs')
const Web3 = require('web3')
const path = require('path')
const MyRinkebyCoinJSON = require('../truffle/build/contracts/MyMainNetCoin.json')
const MyLoomCoinJSON = require('../truffle/build/contracts/MyLoomCoin.json')
const extdevChainId = 'extdev-plasma-us1'
const { OfflineWeb3Signer } = require('loom-js/dist/solidity-helpers')
const TransferGateway = Contracts.TransferGateway

function loadRinkebyAccount () {
  const privateKey = fs.readFileSync(path.join(__dirname, '../rinkeby_private_key'), 'utf-8')
  const web3js = new Web3(`https://rinkeby.infura.io/${process.env.INFURA_API_KEY}`)
  const ownerAccount = web3js.eth.accounts.privateKeyToAccount('0x' + privateKey)
  web3js.eth.accounts.wallet.add(ownerAccount)
  return { account: ownerAccount, web3js }
}

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

async function addContractMapping ({
  client,
  signer,
  tokenRinkebyAddress,
  tokenExtdevAddress,
  ownerExtdevAddress,
  rinkebyTxHash
}) {
  console.log('tokenRinkebyAddress: ' + tokenRinkebyAddress)
  console.log('tokenExtdevAddress: ' + tokenExtdevAddress)
  console.log('ownerExtdevAddress: ' + ownerExtdevAddress)
  const ownerExtdevAddr = Address.fromString(`${client.chainId}:${ownerExtdevAddress}`)
  const gatewayContract = await TransferGateway.createAsync(client, ownerExtdevAddr)
  const foreignContract = Address.fromString(`eth:${tokenRinkebyAddress}`)
  const localContract = Address.fromString(`${client.chainId}:${tokenExtdevAddress}`)

  const hash = soliditySha3(
    { type: 'address', value: tokenRinkebyAddress.slice(2) },
    { type: 'address', value: tokenExtdevAddress.slice(2) }
  )

  const foreignContractCreatorSig = await signer.signAsync(hash)
  const foreignContractCreatorTxHash = Buffer.from(rinkebyTxHash.slice(2), 'hex')

  await gatewayContract.addContractMappingAsync({
    localContract,
    foreignContract,
    foreignContractCreatorSig,
    foreignContractCreatorTxHash
  })
}
async function mapContracts () {
  const rinkeby = loadRinkebyAccount()
  const extdev = loadExtdevAccount()
  const client = extdev.client
  const rinkebyNetworkId = await rinkeby.web3js.eth.net.getId()
  const extdevNetworkId = await extdev.web3js.eth.net.getId()
  let tokenRinkebyAddress, tokenExtdevAddress, rinkebyTxHash
  tokenRinkebyAddress = MyRinkebyCoinJSON.networks[rinkebyNetworkId].address
  rinkebyTxHash = MyRinkebyCoinJSON.networks[rinkebyNetworkId].transactionHash
  tokenExtdevAddress = MyLoomCoinJSON.networks[extdevNetworkId].address
  const signer = new OfflineWeb3Signer(rinkeby.web3js, rinkeby.account)
  await addContractMapping({
    client,
    signer,
    tokenRinkebyAddress,
    tokenExtdevAddress,
    ownerExtdevAddress: extdev.account,
    rinkebyTxHash
  })
  client.disconnect()
}

mapContracts()

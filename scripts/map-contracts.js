const {
  Client, NonceTxMiddleware, SignedTxMiddleware, Address, LocalAddress, CryptoUtils, LoomProvider,
  Contracts, soliditySha3
} = require('loom-js')
const fs = require('fs')
const Web3 = require('web3')
const path = require('path')
const ExtdevBEP2CoinJSON = require('../truffle/build/contracts/SampleBEP2Token.json')
const RinkebyBEP2CoinJSON = require('../mainnet/build/contracts/SampleERC20MintableToken.json')
const RinkebyStandardCoinJSON = require('../truffle/build/contracts/MyMainNetCoin.json')
const ExtdevStandardCoinJSON = require('../truffle/build/contracts/MyLoomCoin.json')
const extdevChainId = 'extdev-plasma-us1'
const { OfflineWeb3Signer } = require('loom-js/dist/solidity-helpers')
const TransferGateway = Contracts.TransferGateway

class ContractsMapper {
  _loadExtdevAccount () {
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

  _loadRinkebyAccount () {
    const privateKey = fs.readFileSync(path.join(__dirname, '../rinkeby_private_key'), 'utf-8')
    const web3js = new Web3(`https://rinkeby.infura.io/${process.env.INFURA_API_KEY}`)
    const ownerAccount = web3js.eth.accounts.privateKeyToAccount('0x' + privateKey)
    web3js.eth.accounts.wallet.add(ownerAccount)
    return { account: ownerAccount, web3js }
  }

  async _addContractMapping ({
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
    try {
      await gatewayContract.addContractMappingAsync({
        localContract,
        foreignContract,
        foreignContractCreatorSig,
        foreignContractCreatorTxHash
      })
    } catch (error) {
      console.log(error)
    }
  }
}

class BEP2ContractsMapper extends ContractsMapper {
  async addMapping () {
    const rinkeby = this._loadRinkebyAccount()
    const extdev = this._loadExtdevAccount()
    const client = extdev.client
    const rinkebyNetworkId = await rinkeby.web3js.eth.net.getId()
    const extdevNetworkId = await extdev.web3js.eth.net.getId()
    const tokenRinkebyAddress = RinkebyBEP2CoinJSON.networks[rinkebyNetworkId].address
    const rinkebyTxHash = RinkebyBEP2CoinJSON.networks[rinkebyNetworkId].transactionHash
    const tokenExtdevAddress = ExtdevBEP2CoinJSON.networks[extdevNetworkId].address
    const signer = new OfflineWeb3Signer(rinkeby.web3js, rinkeby.account)
    await this._addContractMapping({
      client,
      signer,
      tokenRinkebyAddress,
      tokenExtdevAddress,
      ownerExtdevAddress: extdev.account,
      rinkebyTxHash
    })
    client.disconnect()
  }
}

class StandardContractsMapper extends ContractsMapper {
  async addMapping () {
    const rinkeby = this._loadRinkebyAccount()
    const extdev = this._loadExtdevAccount()
    const client = extdev.client
    const rinkebyNetworkId = await rinkeby.web3js.eth.net.getId()
    const extdevNetworkId = await extdev.web3js.eth.net.getId()
    const tokenRinkebyAddress = RinkebyStandardCoinJSON.networks[rinkebyNetworkId].address
    const rinkebyTxHash = RinkebyStandardCoinJSON.networks[rinkebyNetworkId].transactionHash
    const tokenExtdevAddress = ExtdevStandardCoinJSON.networks[extdevNetworkId].address
    const signer = new OfflineWeb3Signer(rinkeby.web3js, rinkeby.account)
    await this._addContractMapping({
      client,
      signer,
      tokenRinkebyAddress,
      tokenExtdevAddress,
      ownerExtdevAddress: extdev.account,
      rinkebyTxHash
    })
    client.disconnect()
  }
}

let mapper
if (process.argv.slice(2)[0] === `bep2`) {
  console.log('Mapping BEP2 contracts.')
  mapper = new BEP2ContractsMapper()
} else if (process.argv.slice(2)[0] === undefined || process.argv.slice(2)[0] === 'standard') {
  console.log('Mapping standard contracts.')
  mapper = new StandardContractsMapper()
}
mapper.addMapping()

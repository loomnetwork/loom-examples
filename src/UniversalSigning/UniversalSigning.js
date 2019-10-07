import {
  Client,
  LocalAddress,
  CryptoUtils,
  LoomProvider,
  Address,
  createDefaultTxMiddleware,
  getMetamaskSigner,
  NonceTxMiddleware,
  SignedEthTxMiddleware,
  EthersSigner
} from 'loom-js'
import Web3 from 'web3'
import networkConfigs from '../../network-configs.json'
import { AddressMapper } from 'loom-js/dist/contracts'

let universalSigningInstance = null

export class UniversalSigning {
  constructor () {
    if (universalSigningInstance === null) {
      universalSigningInstance = this
      return this
    } else {
      return this
    }
  }

  async _load (web3Ethereum) {
    this._loadNetworkConfiguration()
    if (universalSigningInstance.web3Loom !== undefined && universalSigningInstance.accountMapping !== undefined && universalSigningInstance.client !== undefined) {
      const web3Loom = universalSigningInstance.web3Loom
      const accountMapping = universalSigningInstance.accountMapping
      const client = universalSigningInstance.client
      return { web3Loom, accountMapping, client }
    }
    const client = this._createClient()
    client.on('error', console.error)
    const callerAddress = await this._setupSigner(client, web3Ethereum.currentProvider)
    console.log('callerAddress: ' + callerAddress)
    const loomProvider = await this._createLoomProvider(client, callerAddress)
    const web3Loom = new Web3(loomProvider)
    let accountMapping = await this._loadMapping(callerAddress, client)
    if (accountMapping === null) {
      console.log('Create a new mapping')
      const signer = getMetamaskSigner(web3Ethereum.currentProvider)
      await this._createNewMapping(signer)
      accountMapping = await this._loadMapping(callerAddress, client)
      console.log(accountMapping)
    } else {
      console.log('mapping already exists')
    }
    console.log('mapping.ethereum: ' + accountMapping.ethereum.toString())
    console.log('mapping.plasma: ' + accountMapping.plasma.toString())
    this.web3Loom = web3Loom
    this.accountMapping = accountMapping
    this.client = client
    return { web3Loom, accountMapping, client }
  }

  _loadNetworkConfiguration () {
    this.extdevNetworkConfig = networkConfigs.networks['extdev']
    this.rinkebyNetworkConfig = networkConfigs.networks['rinkeby']
  }

  async _createLoomProvider (client, callerAddress) {
    const dummyKey = CryptoUtils.generatePrivateKey()
    const publicKey = CryptoUtils.publicKeyFromPrivateKey(dummyKey)
    const dummyAccount = LocalAddress.fromPublicKey(publicKey).toString()
    const loomProvider = new LoomProvider(
      client,
      dummyKey,
      () => client.txMiddleware
    )
    loomProvider.setMiddlewaresForAddress(callerAddress.local.toString(), client.txMiddleware)
    loomProvider.callerChainId = callerAddress.chainId
    // remove dummy account
    loomProvider.accounts.delete(dummyAccount)
    loomProvider._accountMiddlewares.delete(dummyAccount)
    return loomProvider
  }

  async _setupSigner (plasmaClient, provider) {
    const signer = getMetamaskSigner(provider)
    const ethAddress = await signer.getAddress()
    const callerAddress = new Address('eth', LocalAddress.fromHexString(ethAddress))
    plasmaClient.txMiddleware = [
      new NonceTxMiddleware(callerAddress, plasmaClient),
      new SignedEthTxMiddleware(signer)
    ]
    return callerAddress
  }

  async _loadMapping (ethereumAccount, client) {
    const mapper = await AddressMapper.createAsync(client, ethereumAccount)
    let accountMapping = { ethereum: null, plasma: null }
    try {
      const mapping = await mapper.getMappingAsync(ethereumAccount)
      accountMapping = {
        ethereum: mapping.from,
        plasma: mapping.to
      }
    } catch (error) {
      console.error(error)
      accountMapping = null
    } finally {
      mapper.removeAllListeners()
    }
    return accountMapping
  }

  async _createNewMapping (signer) {
    const ethereumAccount = await signer.getAddress()
    const ethereumAddress = Address.fromString(`eth:${ethereumAccount}`)
    const plasmaEthSigner = new EthersSigner(signer)
    const privateKey = CryptoUtils.generatePrivateKey()
    const publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
    const client = this._createClient()
    client.txMiddleware = createDefaultTxMiddleware(client, privateKey)
    const loomAddress = new Address(client.chainId, LocalAddress.fromPublicKey(publicKey))
    const mapper = await AddressMapper.createAsync(client, loomAddress)
    try {
      await mapper.addIdentityMappingAsync(
        ethereumAddress,
        loomAddress,
        plasmaEthSigner
      )
      client.disconnect()
    } catch (e) {
      if (e.message.includes('Identity mapping already exists.')) {
      } else {
        console.error(e)
      }
      client.disconnect()
      return false
    }
  }

  _createClient () {
    const chainId = this.extdevNetworkConfig['chainId']
    const writeUrl = this.extdevNetworkConfig['writeUrl']
    const readUrl = this.extdevNetworkConfig['readUrl']
    const client = new Client(chainId, writeUrl, readUrl)
    return client
  }
}

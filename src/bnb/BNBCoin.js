import {
  Client,
  LocalAddress,
  CryptoUtils,
  LoomProvider,
  Address,
  createDefaultTxMiddleware,
  NonceTxMiddleware,
  SignedEthTxMiddleware,
  getMetamaskSigner,
  EthersSigner
} from 'loom-js'
import BN from 'bn.js'
import Web3 from 'web3'
import bnbToken from '../../truffle/build/contracts/BNBToken.json'
import { BinanceTransferGateway } from 'loom-js/dist/contracts'
import bech32 from 'bech32'
import { EventBus } from '../EventBus/EventBus'
import networkConfigs from '../../network-configs.json'
import { AddressMapper } from 'loom-js/dist/contracts'

export default class BNBCoin {
  async load (web3js) {
    this.currentNetwork = 'extdev'
    this.networkConfig = networkConfigs.networks[this.currentNetwork]
    const client = this._createClient()
    client.on('error', console.error)
    const callerAddress = await this._setupSigner(client, web3js.currentProvider)
    console.log('callerAddress: ' + callerAddress)
    const loomProvider = await this._createLoomProvider(client, callerAddress)
    const web3 = new Web3(loomProvider)
    let accountMapping = await this._loadMapping(callerAddress, client)
    if (accountMapping === null) {
      console.log('Create a new mapping')
      const signer = getMetamaskSigner(web3js.currentProvider)
      await this._createNewMapping(signer)
      accountMapping = await this._loadMapping(callerAddress, client)
      console.log(accountMapping)
    } else {
      console.log('mapping already exists')
    }
    console.log('mapping.ethereum: ' + accountMapping.ethereum.toString())
    console.log('mapping.plasma: ' + accountMapping.plasma.toString())
    this.accountMapping = accountMapping
    this.web3js = web3js
    this.web3 = web3
    this.client = client
    this._getLoomUserAddress()
    this._getLoomBNBContract()
    await this._getLoomBNBTransferGatewayContract()
    await this._filterEvents()
    await this._refreshBalance()
    EventBus.$emit('updateStatus', { currentStatus: 'waiting' })
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
      if (e.message.includes('identity mapping already exists')) {
      } else {
        console.error(e)
      }
      client.disconnect()
      return false
    }
  }

  _createClient () {
    const chainId = 'extdev-plasma-us1'
    const writeUrl = 'wss://extdev-plasma-us1.dappchains.com/websocket'
    const readUrl = 'wss://extdev-plasma-us1.dappchains.com/queryws'
    const client = new Client(chainId, writeUrl, readUrl)
    return client
  }

  _getLoomUserAddress () {
    this.loomUserAddress = this.accountMapping.plasma.local.toString()
    console.log('this.loomUserAddress: ', this.loomUserAddress)
    EventBus.$emit('loomAddress', { loomAddress: this.loomUserAddress })
  }

  _getLoomBNBContract () {
    this.loomBNBContract = new this.web3.eth.Contract(bnbToken.abi, this.networkConfig['bnbCoinAddress'])
    console.log('this.loomBNBContract: ', this.loomBNBContract)
  }

  async _filterEvents () {
    this.loomBNBContract.events.Transfer({ filter: { address: this.loomUserAddress } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      this._refreshBalance()
    })
  }

  async _refreshBalance () {
    this.bnbBalance = await this.loomBNBContract.methods.balanceOf(this.loomUserAddress).call({ from: this.accountMapping.ethereum.local.toString() })
    this.bnbBalance = this.bnbBalance / 100000000
    console.log('bnbBalance: ' + this.bnbBalance)
    EventBus.$emit('updateBNBBalance', { newBalance: this.bnbBalance })
  }

  async _getLoomBNBTransferGatewayContract () {
    this.loomBNBGateway = await BinanceTransferGateway.createAsync(
      this.client,
      this.accountMapping.ethereum
    )
    console.log('this.loomBNBGateway: ', this.loomBNBGateway)
  }

  async withdrawBNB (binanceAddress, amountToWithdraw) {
    const amountInt = parseFloat(amountToWithdraw) * 100000000
    const fee = 37500
    const loomBNBTransferGatewayAddress = await this._getBinanceTransferGatewayAddress()
    EventBus.$emit('updateStatus', { currentStatus: 'approving' })
    await this.loomBNBContract.methods.approve(loomBNBTransferGatewayAddress, amountInt + fee).send({ from: this.accountMapping.ethereum.local.toString() })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    EventBus.$emit('updateStatus', { currentStatus: 'approved' })
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBNBContract.methods.allowance(this.loomUserAddress, loomBNBTransferGatewayAddress).call({ from: this.accountMapping.ethereum.local.toString() })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'allowanceChecked' })
    const bnbTokenAddress = Address.fromString(this.networkConfig['chainId'] + ':' + this.loomBNBContract._address.toLowerCase())
    const tmp = this._decodeAddress(binanceAddress)
    const recipient = new Address('binance', new LocalAddress(tmp))
    await this.loomBNBGateway.withdrawTokenAsync(new BN(amountInt, 10), bnbTokenAddress, recipient)
    EventBus.$emit('updateStatus', { currentStatus: 'withdrawn' })
    await delay(1000)
    EventBus.$emit('updateStatus', { currentStatus: 'waiting' })
  }

  _decodeAddress (value) {
    const decodeAddress = bech32.decode(value)
    return Buffer.from(bech32.fromWords(decodeAddress.words))
  }

  async approveFee () {
    const fee = 37500
    EventBus.$emit('updateStatus', { currentStatus: 'bnbApproving' })
    const binanceTransferGatewayAddress = await this._getBinanceTransferGatewayAddress()
    await this.loomBNBContract.methods.approve(binanceTransferGatewayAddress, fee).send({ from: this.accountMapping.ethereum.local.toString() })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBNBContract.methods.allowance(this.loomUserAddress, binanceTransferGatewayAddress).call({ from: this.accountMapping.ethereum.local.toString() })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'bnbApproved' })
  }

  async _getBinanceTransferGatewayAddress () {
    const contractAddr = await this.client.getContractAddressAsync('binance-gateway')
    return contractAddr.local.toString()
  }
}

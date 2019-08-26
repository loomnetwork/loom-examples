import {
  Client, LocalAddress, CryptoUtils, LoomProvider, Address, createDefaultTxMiddleware, getMetamaskSigner, NonceTxMiddleware, SignedEthTxMiddleware
} from 'loom-js'
import BN from 'bn.js'
import Web3 from 'web3'
import bep2Token from '../../truffle/build/contracts/SampleBEP2Token.json'
import { BinanceTransferGateway } from 'loom-js/dist/contracts'
import bech32 from 'bech32'
import { EventBus } from '../EventBus/EventBus'
import networkConfigs from '../../network-configs.json'
import { AddressMapper } from 'loom-js/dist/contracts'

export default class BEP2Coin {
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
    this._getLoomBEP2Contract()
    await this._getLoomBEP2TransferGatewayContract()
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
    EventBus.$emit('updateBep2LoomAddress', { loomAddress: this.loomUserAddress })
  }

  _getLoomBEP2Contract () {
    const networkId = this.networkConfig['networkId']
    const bep2CoinAddress = bep2Token.networks[networkId].address
    this.loomBEP2Contract = new this.web3.eth.Contract(bep2Token.abi, bep2CoinAddress)
  }

  async _filterEvents () {
    this.loomBEP2Contract.events.Transfer({ filter: { address: this.loomUserAddress } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      this._refreshBalance()
    })
  }

  async _refreshBalance () {
    this.bep2Balance = await this.loomBEP2Contract.methods.balanceOf(this.loomUserAddress).call({ from: this.accountMapping.ethereum.local.toString() })
    this.bep2Balance = this.bep2Balance / 100000000
    EventBus.$emit('updateBEP2Balance', { newBalance: this.bep2Balance })
  }

  async _getLoomBEP2TransferGatewayContract () {
    this.loomBEP2Gateway = await BinanceTransferGateway.createAsync(
      this.client,
      this.accountMapping.ethereum
    )
  }

  async _getBinanceTransferGatewayAddress () {
    const contractAddr = await this.client.getContractAddressAsync('binance-gateway')
    return contractAddr.local.toString()
  }

  async withdrawBEP2 (binanceAddress, amountToWithdraw) {
    const amountInt = amountToWithdraw * 100000000
    EventBus.$emit('updateStatus', { currentStatus: 'bep2Approving' })
    const binanceTransferGatewayAddress = await this._getBinanceTransferGatewayAddress()
    await this.loomBEP2Contract.methods.approve(binanceTransferGatewayAddress, amountInt).send({ from: this.accountMapping.ethereum.local.toString() })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    EventBus.$emit('updateStatus', { currentStatus: 'bep2Approved' })
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBEP2Contract.methods.allowance(this.loomUserAddress, binanceTransferGatewayAddress).call({ from: this.accountMapping.ethereum.local.toString() })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'bep2AllowanceChecked' })
    const bep2TokenAddress = Address.fromString('extdev-plasma-us1:' + this.loomBEP2Contract._address.toLowerCase())
    const tmp = this._decodeAddress(binanceAddress)
    const recipient = new Address('binance', new LocalAddress(tmp))
    await this.loomBEP2Gateway.withdrawTokenAsync(new BN(amountInt, 10), bep2TokenAddress, recipient)
    EventBus.$emit('updateStatus', { currentStatus: 'bep2Withdrawn' })
    await delay(1000)
    EventBus.$emit('updateStatus', { currentStatus: 'waiting' })
  }

  _decodeAddress (value) {
    const decodeAddress = bech32.decode(value)
    return Buffer.from(bech32.fromWords(decodeAddress.words))
  }
}

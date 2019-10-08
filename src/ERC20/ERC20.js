import GatewayJSON from '../../truffle/build/contracts/Gateway.json'
import {
  NonceTxMiddleware,
  SignedEthTxMiddleware,
  CryptoUtils,
  Client,
  LoomProvider,
  Address,
  LocalAddress,
  Contracts,
  EthersSigner,
  createDefaultTxMiddleware,
  createEthereumGatewayAsync,
  getMetamaskSigner
} from 'loom-js'

import { AddressMapper } from 'loom-js/dist/contracts'
import { EventBus } from '../EventBus/EventBus'
import MainNetCoinJSON from '../../mainnet/build/contracts/MyMainNetCoin.json'
import LoomCoinJSON from '../../truffle/build/contracts/MyLoomCoin.json'
import networkConfigs from '../../network-configs.json'

const Web3 = require('web3')
const BN = require('bn.js')

export default class ERC20 {
  _gas () {
    return 350000
  }

  _RinkebyGatewayAddress () {
    return this.extdevConfig['rinkeby2ExtdevGatewayAddress']
  }

  async load (web3js) {
    this._loadNetworkConfiguration()
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
    this.web3loom = web3
    await this._getContracts(client, web3js, accountMapping)
    await this._updateBalances()
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

  _loadNetworkConfiguration () {
    this.extdevConfig = networkConfigs.networks['extdev']
    this.rinkebyConfig = networkConfigs.networks['rinkeby']
  }

  _createClient () {
    const chainId = this.extdevConfig['chainId']
    const writeUrl = this.extdevConfig['writeUrl']
    const readUrl = this.extdevConfig['readUrl']
    const client = new Client(chainId, writeUrl, readUrl)
    return client
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

  async _getContracts (client, web3js, accountMapping) {
    this.mainNetGatewayContract = await new this.web3js.eth.Contract(
      GatewayJSON.abi,
      this.extdevConfig['rinkeby2ExtdevGatewayAddress']
    )
    console.log('mainNetGatewayContract: ', this.mainNetGatewayContract)

    this.loomGatewayContract = await Contracts.TransferGateway.createAsync(
      client,
      accountMapping.ethereum
    )
    console.log('loomGatewayContract: ', this.loomGatewayContract)

    const mainNetCoinContractAddress = MainNetCoinJSON.networks[this.rinkebyConfig['networkId']].address
    console.log('mainNetCoinContractAddress: ' + mainNetCoinContractAddress)
    this.mainNetCoinContract = await new this.web3js.eth.Contract(MainNetCoinJSON.abi, mainNetCoinContractAddress)
    console.log('mainNetCoinContract: ', this.mainNetCoinContract)

    const loomCoinContractAddress = LoomCoinJSON.networks[this.extdevConfig['networkId']].address
    console.log('loomCoinContractAddress: ' + loomCoinContractAddress)
    this.loomCoinContract = new this.web3loom.eth.Contract(LoomCoinJSON.abi, loomCoinContractAddress)
    console.log('loomCoinContract', this.loomCoinContract)

    const networkId = await this.web3js.eth.net.getId()
    let version
    switch (networkId) {
      case 1: // Ethereum Mainnet
        version = 1
        break

      case 4: // Rinkeby
        version = 2
        break
      default:
        throw new Error('Ethereum Gateway is not deployed on network ' + networkId)
    }

    const signer = getMetamaskSigner(this.web3js.currentProvider)

    this.ethereumGatewayContract = await createEthereumGatewayAsync(
      version,
      this._RinkebyGatewayAddress(),
      signer
    )
  }

  async _updateBalances () {
    const mainNetBalance = await this._getMainNetBalance()
    const loomBalance = await this._getLoomBalance()
    EventBus.$emit('updateBalances', { mainNetBalance: mainNetBalance, loomBalance: loomBalance })
  }

  async _getLoomBalance () {
    const loomWei = await this.loomCoinContract.methods
      .balanceOf(this.accountMapping.plasma.local.toString())
      .call({
        from: this.accountMapping.ethereum.local.toString()
      })
    const balance = this.web3loom.utils.fromWei(loomWei.toString(), 'ether')
    const limitDecimals = parseFloat(balance).toFixed(2)
    return limitDecimals
  }

  async _getMainNetBalance () {
    const loomWei = await this.mainNetCoinContract.methods
      .balanceOf(this.accountMapping.ethereum.local.toString())
      .call({
        from: this.accountMapping.ethereum.local.toString()
      })
    const balance = this.web3js.utils.fromWei(loomWei.toString(), 'ether')
    const limitDecimals = parseFloat(balance).toFixed(2)
    return limitDecimals
  }

  async depositERC20 (amount) {
    const rinkebyGatewayAddress = this.extdevConfig['rinkeby2ExtdevGatewayAddress']
    const amountInWei = this.web3js.utils.toWei(amount.toString(), 'ether')
    const mainNetContractAddress = MainNetCoinJSON.networks[this.rinkebyConfig['networkId']].address
    const ethAddress = this.accountMapping.ethereum.local.toString()
    console.log('Calling approve.')
    try {
      await this.mainNetCoinContract
        .methods
        .approve(
          rinkebyGatewayAddress,
          amountInWei
        )
        .send({ from: ethAddress })
    } catch (error) {
      console.log('Failed to approve Ethereum Gateway to take the coins.')
      throw error
    }
    console.log('Calling depositERC20.')
    try {
      await this.mainNetGatewayContract
        .methods
        .depositERC20(
          amountInWei,
          mainNetContractAddress
        )
        .send({ from: ethAddress, gas: '489362' })
    } catch (error) {
      console.log('Failed to transfer coin to the Ethereum Gateway')
      throw error
    }
    console.log('Coins deposited.')
  }

  async withdrawERC20 (amount) {
    console.log('Transferring to Loom Gateway.')
    await this._transferCoinsToLoomGateway(amount)
    console.log('Getting withdrawal receipt')
    const receipt = await this._getWithdrawalReceipt()
    console.log('Withdrawing from MainNet Gateway')
    await this._withdrawCoinsFromMainNetGateway(receipt)
  }

  async _transferCoinsToLoomGateway (amount) {
    const amountInWei = this.web3js.utils.toWei(amount.toString(), 'ether')
    const dAppChainGatewayAddr = this.web3loom.utils.toChecksumAddress(this.extdevConfig['extdev2RinkebyGatewayAddress'])
    const ethAddress = this.accountMapping.ethereum.local.toString()
    console.log('Approving Loom Transfer Gateway to take the coins.')
    await this.loomCoinContract.methods
      .approve(dAppChainGatewayAddr, amountInWei)
      .send({ from: ethAddress })

    const timeout = 60 * 1000
    const ownerMainnetAddr = Address.fromString('eth:' + ethAddress)
    const loomCoinContractAddress = LoomCoinJSON.networks[this.extdevConfig['networkId']].address
    const tokenAddress = Address.fromString(this.extdevConfig['chainId'] + ':' + loomCoinContractAddress)
    const mainNetContractAddress = MainNetCoinJSON.networks[this.rinkebyConfig['networkId']].address
    const gatewayContract = this.loomGatewayContract

    const receiveSignedWithdrawalEvent = new Promise((resolve, reject) => {
      let timer = setTimeout(
        () => reject(new Error('Timeout while waiting for withdrawal to be signed')),
        timeout
      )
      const listener = event => {
        const tokenEthAddress = Address.fromString('eth:' + mainNetContractAddress)
        if (
          event.tokenContract.toString() === tokenEthAddress.toString() &&
          event.tokenOwner.toString() === ownerMainnetAddr.toString()
        ) {
          clearTimeout(timer)
          timer = null
          gatewayContract.removeAllListeners(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL)
          console.log('Oracle signed tx ', CryptoUtils.bytesToHexAddr(event.sig))
          resolve(event)
        }
      }
      gatewayContract.on(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL, listener)
    })
    await gatewayContract.withdrawERC20Async(
      new BN(amountInWei, 10),
      tokenAddress,
      ownerMainnetAddr
    )
    await receiveSignedWithdrawalEvent
  }

  async _getWithdrawalReceipt () {
    const userLocalAddr = Address.fromString(this.accountMapping.plasma.toString())
    const gatewayContract = this.loomGatewayContract
    const receipt = await gatewayContract.withdrawalReceiptAsync(userLocalAddr)
    return receipt
  }

  async _withdrawCoinsFromMainNetGateway (receipt) {
    // const mainNetContractAddress = MainNetCoinJSON.networks[this.rinkebyConfig['networkId']].address
    // const ethAddress = this.accountMapping.ethereum.local.toString()
    const gatewayContract = this.ethereumGatewayContract
    const gas = this._gas()
    const tx = await gatewayContract.withdrawAsync(receipt, { gasLimit: gas })
    console.log(`Tokens withdrawn from MainNet Gateway.`)
    console.log(`Rinkeby tx hash: ${tx.hash}`)
  }

  async resumeWithdrawal () {
    const receipt = await this._getWithdrawalReceipt()
    if (receipt !== undefined) {
      await this._withdrawCoinsFromMainNetGateway(receipt)
    }
  }

  async _filterEvents () {
    this.loomCoinContract.events.Transfer({ filter: { address: this.accountMapping.plasma.local.toString() } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      await this._updateBalances()
    })
    this.mainNetCoinContract.events.Transfer({ filter: { address: this.accountMapping.ethereum.local.toString() } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      await this._updateBalances()
    })
  }
}

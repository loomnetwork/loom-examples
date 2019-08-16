import { ethers } from 'ethers'
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
  getMetamaskSigner,
} from 'loom-js'

import { AddressMapper } from 'loom-js/dist/contracts'

import { EventBus } from './EventBus'

const Web3 = require('web3')
const BN = require('bn.js')
const EthCoin = Contracts.EthCoin

export default class LoomEthCoin {
  _amountToWithdraw () {
    return 50000
  }

  _amountToDeposit () {
    return 500000
  }

  _gas () {
    return 350000
  }

  _loomGatewayAddress () {
    return '0xE754d9518bF4a9C63476891eF9Aa7D91c8236a5d'
  }

  _mainNetGatewayAddress () {
    return '0xb73C9506cb7f4139A4D6Ac81DF1e5b6756Fab7A2'
  }

  async load (web3js) {
    const client = this._createClient()
    client.on('error', console.error)
    const callerAddress = await this._setupSigner(client, web3js.currentProvider)
    console.log('callerAddress: ' + callerAddress)
    const loomProvider = await this._createLoomProvider(client, callerAddress)
    const web3 = new Web3(loomProvider)
    let accountMapping = await this._loadMapping(callerAddress, client)
    if (accountMapping === null) {
      console.log('Create a new mapping')
      await this._createNewMapping(web3js.currentProvider)
      accountMapping = await this.plasma_loadMapping(callerAddress, client)
    } else {
      console.log('mapping already exists')
    }
    this.accountMapping = accountMapping
    this.web3js = web3js
    this._getContracts(client, web3, accountMapping)
    this._updateBalances()
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

  _createClient () {
    const chainId = 'extdev-plasma-us1'
    const writeUrl = 'wss://extdev-plasma-us1.dappchains.com/websocket'
    const readUrl = 'wss://extdev-plasma-us1.dappchains.com/queryws'
    const client = new Client(chainId, writeUrl, readUrl)
    return client
  }
  
  async createNewMapping(signer) {

    // const ethereumAccount = await signer.getAddress()
    // const ethereumAddress = Address.fromString(`eth:${ethereumAccount}`)

    // // wrap the eth signer in a loom-js signer
    // const plasmaEthSigner = new EthersSigner(signer)
    // // create a new plasma account
    // const plasmaId = generateNewId()

    // // create a client and connect with this plasma account
    // // use the newly created plasma key as the caller
    // const { client } = createDefaultClient(
    //     CryptoUtils.Uint8ArrayToB64(plasmaId.privateKey),
    //     config.plasma.endpoint,
    //     config.plasma.chainId,
    // )

    // const mapper = await AddressMapper.createAsync(client, plasmaId.address)
    // try {
    //     await mapper.addIdentityMappingAsync(
    //         ethereumAddress,
    //         plasmaId.address,
    //         plasmaEthSigner,
    //     )
    //     // disconnect the temporary client we used to create the mappiing
    //     client.disconnect()
    // } catch (e) {
    //     if (e.message.includes("identity mapping already exists")) {
    //         // should handle the error and just retry loading the mapping
    //     } else {
    //         console.error(e)
    //     }
    //     client.disconnect()
    //     return false

    // }
  }

  async _getContracts (client, web3, accountMapping) {
    this.mainNetGatewayContract = await new web3.eth.Contract(
      GatewayJSON.abi,
      this._mainNetGatewayAddress()
    )
    console.log('Initialized mainNetGatewayContract')
    this.ethCoin = await EthCoin.createAsync(
      client,
      accountMapping.ethereum
    )
    console.log('Initialized ethCoin')
    this.loomGatewayContract = await Contracts.TransferGateway.createAsync(
      client,
      accountMapping.plasma
    )
    console.log('Initialized loomGatewayContract')
  }

  async depositEth () {
    console.log('deposit eth')
    const ethereumAddress = this.accountMapping.ethereum.local.toString()
    const gasPrice = this.web3js.utils.toHex(10e9)
    try {
      await this.web3js.eth.sendTransaction({
        from: ethereumAddress,
        to: this._mainNetGatewayAddress(),
        value: this._amountToDeposit(),
        gasLimit: this._gas(),
        gasPrice: gasPrice
      })
    } catch (error) {
      console.log(error)
    }
  }

  async _approveGatewayToTakeEth () {
    console.log('Approving the gateway to take the eth')
    const totalAmount = this._amountToDeposit() + this._gas()
    const gatewayAddress = Address.fromString('extdev-plasma-us1:' + this._loomGatewayAddress())
    await this.ethCoin.approveAsync(gatewayAddress, new BN(totalAmount))
  }

  async _transferEthToLoomGateway () {
    console.log('transfer eth to loom gateway')
    const ownerAddr = this.accountMapping.plasma
    const loomGatewayAddr = Address.fromString(`extdev-plasma-us1:${this._loomGatewayAddress()}`)
    const timeout = 60 * 1000
    const receiveSignedWithdrawalEvent = new Promise((resolve, reject) => {
      let timer = setTimeout(
        () => reject(new Error('Timeout while waiting for withdrawal to be signed')),
        timeout
      )
      const listener = event => {
        if (
          event.tokenContract.toString() === loomGatewayAddr.toString() &&
          event.tokenOwner.toString() === ownerAddr.toString()
        ) {
          clearTimeout(timer)
          timer = null
          this.loomGatewayContract.removeAllListeners(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL)
          resolve(event)
        }
      }
      this.loomGatewayContract.on(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL, listener)
    })
    const amount = this._amountToDeposit()
    console.log('before withdrawEthAsync')
    await this.loomGatewayContract.withdrawETHAsync(new BN(amount), loomGatewayAddr, ownerAddr)
    console.log(`${amount.toString()} wei deposited to DAppChain Gateway...`)
    await receiveSignedWithdrawalEvent
  }

  async _getWithdrawalReceipt () {
    const userLocalAddr = this.accountMapping.plasma
    const gatewayContract = this.loomGatewayContract
    const data = await gatewayContract.withdrawalReceiptAsync(userLocalAddr)
    if (!data) {
      return null
    }
    const signature = CryptoUtils.bytesToHexAddr(data.oracleSignature)
    return {
      signature: signature,
      amount: data.value.toString(10),
      tokenContract: data.tokenContract.local.toString()
    }
  }

  async withdrawEthFromMainNetGateway (amount, data) {
    const gas = this._gas()
    const gatewayContract = this.mainNetGatewayContract
    const ethereumAddress = this.accountMapping.ethereum.toString()
    const gasEstimate = gatewayContract.methods
      .withdrawETH(amount.toString(), data.signature)
      .estimateGas({ from: ethereumAddress, gas })
    if (gasEstimate == gas) {
      throw new Error('Not enough enough gas, send more.')
    }
    return gatewayContract.methods
      .withdrawETH(amount.toString(), data.signature)
      .send({ from: ethereumAddress })
  }

  async withdrawEth () {
    await this._approveGatewayToTakeEth()
    await this._transferEthToLoomGateway()
    const data = await this.getWithdrawalReceipt()
    if (data !== undefined) {
      const amount = this._amountToWithdraw()
      await this._withdrawEthFromMainNetGateway(amount, data)
    }
  }

  async _updateBalances () {
    const mainNetBalance = await this._getMainNetBalance()
    const loomBalance = await this._getLoomBalance()
    EventBus.$emit('updateBalances', { mainNetBalance: mainNetBalance, loomBalance: loomBalance })
  }

  async _getMainNetBalance () {
    const wei = await this.web3js.eth.getBalance(this.accountMapping.ethereum.local.toString())
    return this.web3js.utils.fromWei(wei.toString(), 'ether')
  }

  async _getLoomBalance () {
    const loomAddress = Address.fromString(this.accountMapping.plasma.toString())
    const wei = await this.ethCoin.getBalanceOfAsync(loomAddress)
    return this.web3js.utils.fromWei(wei.toString(), 'ether')
  }
}

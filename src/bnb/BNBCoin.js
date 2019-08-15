import {
  Client, LocalAddress, CryptoUtils, LoomProvider, Address, createDefaultTxMiddleware
} from 'loom-js'
import BN from 'bn.js'
import Web3 from 'web3'
import bnbToken from '../../truffle/build/contracts/BNBToken.json'
import { BinanceTransferGateway } from 'loom-js/dist/contracts'
import bech32 from 'bech32'
import { EventBus } from '../EventBus/EventBus'
import networkConfigs from '../../network-configs.json'

export default class BNBCoin {
  async load () {
    this.currentNetwork = 'extdev'
    this.networkConfig = networkConfigs.networks[this.currentNetwork]
    this._createClient()
    this._getLoomUserAddress()
    this._getWeb3Instance()
    this._getLoomBNBContract()
    await this._getLoomBNBTransferGatewayContract()
    await this._filterEvents()
    await this._refreshBalance()
    EventBus.$emit('updateStatus', { currentStatus: 'waiting' })
  }

  _createClient () {
    this.privateKey = this._getPrivateKey()
    this.publicKey = CryptoUtils.publicKeyFromPrivateKey(this.privateKey)
    this.client = new Client(this.networkConfig['chainId'], this.networkConfig['writeUrl'], this.networkConfig['readUrl'])
    this.client.on('error', msg => {
      console.error('Error connecting to Loom Testnet.', msg)
    })
    this.client.txMiddleware = createDefaultTxMiddleware(this.client, this.privateKey)
  }

  _getPrivateKey () {
    let privateKey = localStorage.getItem('loom_binance_pk')
    if (!privateKey) {
      privateKey = CryptoUtils.generatePrivateKey()
      localStorage.setItem('loom_binance_pk', JSON.stringify(Array.from(privateKey)))
    } else {
      privateKey = new Uint8Array(JSON.parse(privateKey))
    }
    return privateKey
  }

  _getLoomUserAddress () {
    this.loomUserAddress = LocalAddress.fromPublicKey(this.publicKey).toString()
    EventBus.$emit('loomAddress', { loomAddress: this.loomUserAddress })
  }

  _getWeb3Instance () {
    this.web3 = new Web3(new LoomProvider(this.client, this.privateKey))
  }

  _getLoomBNBContract () {
    this.loomBNBContract = new this.web3.eth.Contract(bnbToken.abi, this.networkConfig['bnbCoinAddress'])
  }

  async _filterEvents () {
    this.loomBNBContract.events.Transfer({ filter: { address: this.loomUserAddress } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      this._refreshBalance()
    })
  }

  async _refreshBalance () {
    this.bnbBalance = await this.loomBNBContract.methods.balanceOf(this.loomUserAddress).call({ from: this.loomUserAddress })
    this.bnbBalance = this.bnbBalance / 100000000
    EventBus.$emit('updateBNBBalance', { newBalance: this.bnbBalance })
  }

  async _getLoomBNBTransferGatewayContract () {
    this.loomBNBGateway = await BinanceTransferGateway.createAsync(
      this.client,
      Address.fromString(this.networkConfig['chainId'] + ':' + this.loomUserAddress)
    )
  }

  async withdrawBNB (binanceAddress, amountToWithdraw) {
    const amountInt = parseFloat(amountToWithdraw) * 100000000
    const fee = 37500
    const loomBNBTransferGatewayAddress = await this._getBinanceTransferGatewayAddress()
    EventBus.$emit('updateStatus', { currentStatus: 'approving' })
    await this.loomBNBContract.methods.approve(loomBNBTransferGatewayAddress, amountInt + fee).send({ from: this.loomUserAddress })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    EventBus.$emit('updateStatus', { currentStatus: 'approved' })
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBNBContract.methods.allowance(this.loomUserAddress, loomBNBTransferGatewayAddress).call({ from: this.loomUserAddress })
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
    await this.loomBNBContract.methods.approve(binanceTransferGatewayAddress, fee).send({ from: this.loomUserAddress })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBNBContract.methods.allowance(this.loomUserAddress, binanceTransferGatewayAddress).call({ from: this.loomUserAddress })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'bnbApproved' })
  }

  async _getBinanceTransferGatewayAddress () {
    const contractAddr = await this.client.getContractAddressAsync('binance-gateway')
    return contractAddr.local.toString()
  }
}

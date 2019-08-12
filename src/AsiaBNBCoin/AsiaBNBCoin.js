import {
  Client, LocalAddress, CryptoUtils, LoomProvider, Address, createDefaultTxMiddleware
} from 'loom-js'
import BN from 'bn.js'
import Web3 from 'web3'
import { BinanceTransferGateway } from 'loom-js/dist/contracts'
import bech32 from 'bech32'
import { EventBus } from '../EventBus/EventBus'
import bnbToken from '../../truffle/build/contracts/BNBToken.json'
import networkConfigs from '../../network-configs.json'

export default class AsiaBNBCoin {
  async load () {
    this.currentNetwork = 'asia1'
    this.networkConfig = networkConfigs.networks[this.currentNetwork]
    this._createClient()
    this._getLoomUserAddress()
    this._getWeb3Instance()
    this._getLoomBNBContract()
    await this._getLoomBNBTransferGatewayContract()
    await this._filterEvents()
    await this._refreshBalance()
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
    let privateKey = localStorage.getItem('loom_bep2_pk')
    if (!privateKey) {
      privateKey = CryptoUtils.generatePrivateKey()
      localStorage.setItem('loom_bep2_pk', JSON.stringify(Array.from(privateKey)))
    } else {
      privateKey = new Uint8Array(JSON.parse(privateKey))
    }
    return privateKey
  }
  _getLoomUserAddress () {
    this.loomUserAddress = LocalAddress.fromPublicKey(this.publicKey).toString()
    console.log('Loom user address in AsiaBNBCoin: ' + this.loomUserAddress)
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
    console.log('Unformated BNB balance: ' + this.bnbBalance)
    this.bnbBalance = this.bnbBalance / 100000000
    console.log('Formatted BNB balance: ' + this.bnbBalance)
    EventBus.$emit('updateBNBBalance', { newBalance: this.bnbBalance })
  }

  async _getLoomBNBTransferGatewayContract () {
    this.loomBNBGateway = await BinanceTransferGateway.createAsync(
      this.client,
      Address.fromString('asia1:' + this.loomUserAddress)
    )
  }
  async withdrawBNB (binanceAddress) {
    const amountInt = 12300000
    const fee = 37500
    await this.loomBNBContract.methods.approve(this.networkConfig['binanceTransferGatewayAddress'].toLowerCase(), amountInt + fee).send({ from: this.loomUserAddress })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBNBContract.methods.allowance(this.loomUserAddress, this.networkConfig['binanceTransferGatewayAddress'].toLowerCase()).call({ from: this.loomUserAddress })
      await delay(5000)
    }
    const bnbTokenAddress = Address.fromString('asia1:' + this.loomBNBContract._address.toLowerCase())
    const tmp = this._decodeAddress(binanceAddress)
    const recipient = new Address('binance', new LocalAddress(tmp))
    await this.loomBNBGateway.withdrawTokenAsync(new BN(amountInt - fee, 10), bnbTokenAddress, recipient)
  }
  async approveFee () {
    const fee = 37500
    EventBus.$emit('updateStatus', { currentStatus: 'bnbApproving' })
    await this.loomBNBContract.methods.approve(this.networkConfig['binanceTransferGatewayAddress'].toLowerCase(), fee).send({ from: this.loomUserAddress })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBNBContract.methods.allowance(this.loomUserAddress, this.networkConfig['binanceTransferGatewayAddress'].toLowerCase()).call({ from: this.loomUserAddress })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'bnbApproved' })
    console.log('Approved the transfer gateway to take the fee.')
  }
  _decodeAddress (value) {
    const decodeAddress = bech32.decode(value)
    return Buffer.from(bech32.fromWords(decodeAddress.words))
  }
}

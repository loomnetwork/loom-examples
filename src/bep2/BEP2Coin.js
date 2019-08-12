import {
  Client, LocalAddress, CryptoUtils, LoomProvider, Address, createDefaultTxMiddleware
} from 'loom-js'
import BN from 'bn.js'
import Web3 from 'web3'
import bep2Token from '../../truffle/build/contracts/SampleBEP2Token.json'
import { BinanceTransferGateway } from 'loom-js/dist/contracts'
import bech32 from 'bech32'
import { EventBus } from '../EventBus/EventBus'
import networkConfigs from '../../network-configs.json'

export default class BEP2Coin {
  async load () {
    this.currentNetwork = 'asia1'
    this.networkConfig = networkConfigs.networks[this.currentNetwork]
    this._createClient()
    this._getLoomUserAddress()
    this._getWeb3Instance()
    this._getLoomBEP2Contract()
    this._doTempStuff()
    await this._getLoomBEP2TransferGatewayContract()
    await this._filterEvents()
    await this._refreshBalance()
    EventBus.$emit('updateStatus', { currentStatus: 'waiting' })
  }

  _createClient () {
    this.privateKey = this._getPrivateKey()
    this.publicKey = CryptoUtils.publicKeyFromPrivateKey(this.privateKey)
    this.client = new Client(this.networkConfig['chainId'], this.networkConfig['writeUrl'], this.networkConfig['readUrl'])
    this.client.on('error', msg => {
      console.error('Error connecting to asia1.', msg)
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
    console.log('bep2loomaddr: ' + this.loomUserAddress)
    EventBus.$emit('updateBep2LoomAddress', { loomAddress: this.loomUserAddress })
  }

  _getWeb3Instance () {
    this.web3 = new Web3(new LoomProvider(this.client, this.privateKey))
  }

  _doTempStuff () {
    let tempAddress = this.loomUserAddress.slice(2, this.loomUserAddress.length)
    tempAddress = 'loom' + tempAddress
    console.log('tempAddress: ' + tempAddress)
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
    console.log(this.loomBEP2Contract.methods)
    console.log(this.loomUserAddress)
    this.bep2Balance = await this.loomBEP2Contract.methods.balanceOf(this.loomUserAddress).call({ from: this.loomUserAddress })
    this.bep2Balance = this.bep2Balance / 100000000
    console.log(this.bep2Balance)
    EventBus.$emit('updateBEP2Balance', { newBalance: this.bep2Balance })
  }

  async _getLoomBEP2TransferGatewayContract () {
    this.loomBEP2Gateway = await BinanceTransferGateway.createAsync(
      this.client,
      Address.fromString('asia1:' + this.loomUserAddress)
    )
  }

  async withdrawBEP2 (binanceAddress, amountToWithdraw) {
    const amountInt = amountToWithdraw * 100000000
    EventBus.$emit('updateStatus', { currentStatus: 'bep2Approving' })
    await this.loomBEP2Contract.methods.approve(this.networkConfig['binanceTransferGatewayAddress'].toLowerCase(), amountInt).send({ from: this.loomUserAddress })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    EventBus.$emit('updateStatus', { currentStatus: 'bep2Approved' })
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBEP2Contract.methods.allowance(this.loomUserAddress, this.networkConfig['binanceTransferGatewayAddress'].toLowerCase()).call({ from: this.loomUserAddress })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'bep2AllowanceChecked' })
    const bep2TokenAddress = Address.fromString('asia1:' + this.loomBEP2Contract._address.toLowerCase())
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

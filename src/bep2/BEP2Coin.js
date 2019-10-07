import {
  LocalAddress,
  Address
} from 'loom-js'
import BN from 'bn.js'
import bep2Token from '../../truffle/build/contracts/SampleBEP2Token.json'
import { BinanceTransferGateway } from 'loom-js/dist/contracts'
import bech32 from 'bech32'
import { EventBus } from '../EventBus/EventBus'
import { UniversalSigning } from '../UniversalSigning/UniversalSigning'

export default class BEP2Coin extends UniversalSigning {
  async load (web3Ethereum) {
    const { web3Loom, accountMapping, client } = await super._load(web3Ethereum)
    this.accountMapping = accountMapping
    this.web3Ethereum = web3Ethereum
    this.web3Loom = web3Loom
    this.client = client
    this._getLoomUserAddress()
    this._getLoomBEP2Contract()
    await this._getLoomBEP2TransferGatewayContract()
    await this._filterEvents()
    await this._refreshBalance()
  }

  _getLoomUserAddress () {
    this.loomUserAddress = this.accountMapping.plasma.local.toString()
    EventBus.$emit('updateBep2LoomAddress', { loomAddress: this.loomUserAddress })
  }

  _getLoomBEP2Contract () {
    const networkId = this.extdevNetworkConfig['networkId']
    const bep2CoinAddress = bep2Token.networks[networkId].address
    this.loomBEP2Contract = new this.web3Loom.eth.Contract(bep2Token.abi, bep2CoinAddress)
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
    EventBus.$emit('updateStatus', { currentStatus: 'Approving the gateway to take the tokens.' })
    const binanceTransferGatewayAddress = await this._getBinanceTransferGatewayAddress()
    await this.loomBEP2Contract.methods.approve(binanceTransferGatewayAddress, amountInt).send({ from: this.accountMapping.ethereum.local.toString() })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    EventBus.$emit('updateStatus', { currentStatus: 'Approved. Next -> Checking the allowance.' })
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBEP2Contract.methods.allowance(this.loomUserAddress, binanceTransferGatewayAddress).call({ from: this.accountMapping.ethereum.local.toString() })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'Allowance checked. Next -> Withdrawing tokens to Binance.' })
    const bep2TokenAddress = Address.fromString('extdev-plasma-us1:' + this.loomBEP2Contract._address.toLowerCase())
    const tmp = this._decodeAddress(binanceAddress)
    const recipient = new Address('binance', new LocalAddress(tmp))
    await this.loomBEP2Gateway.withdrawTokenAsync(new BN(amountInt, 10), bep2TokenAddress, recipient)
    EventBus.$emit('updateStatus', { currentStatus: 'Succesfully withdrawn!' })
  }

  _decodeAddress (value) {
    const decodeAddress = bech32.decode(value)
    return Buffer.from(bech32.fromWords(decodeAddress.words))
  }
}

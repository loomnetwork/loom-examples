import {
  LocalAddress,
  Address
} from 'loom-js'
import BN from 'bn.js'
import bnbToken from '../../truffle/build/contracts/BNBToken.json'
import { BinanceTransferGateway } from 'loom-js/dist/contracts'
import bech32 from 'bech32'
import { EventBus } from '../EventBus/EventBus'
import { UniversalSigning } from '../UniversalSigning/UniversalSigning'

export default class BNBCoin extends UniversalSigning {
  async load (web3Ethereum) {
    const { web3Loom, accountMapping, client } = await super._load(web3Ethereum)
    this.web3Loom = web3Loom
    this.accountMapping = accountMapping
    this.client = client
    this._getLoomUserAddress()
    this._getLoomBNBContract()
    await this._getLoomBNBTransferGatewayContract()
    await this._filterEvents()
    await this._refreshBalance()
  }

  _getLoomUserAddress () {
    this.loomUserAddress = this.accountMapping.plasma.local.toString()
    console.log('this.loomUserAddress: ', this.loomUserAddress)
    EventBus.$emit('loomAddress', { loomAddress: this.loomUserAddress })
  }

  _getLoomBNBContract () {
    this.loomBNBContract = new this.web3Loom.eth.Contract(bnbToken.abi, this.extdevNetworkConfig['bnbCoinAddress'])
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
    EventBus.$emit('updateBNBBalance', { newBalance: this.bnbBalance })
  }

  async _getLoomBNBTransferGatewayContract () {
    this.loomBNBGateway = await BinanceTransferGateway.createAsync(
      this.client,
      this.accountMapping.ethereum
    )
  }

  async withdrawBNB (binanceAddress, amountToWithdraw) {
    const amountInt = parseFloat(amountToWithdraw) * 100000000
    const fee = 37500
    const loomBNBTransferGatewayAddress = await this._getBinanceTransferGatewayAddress()
    EventBus.$emit('updateStatus', { currentStatus: 'Approving the gateway to take the BNB tokens.' })
    await this.loomBNBContract.methods.approve(loomBNBTransferGatewayAddress, amountInt + fee).send({ from: this.accountMapping.ethereum.local.toString() })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    EventBus.$emit('updateStatus', { currentStatus: 'Approved. Next -> checking allowance.' })
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBNBContract.methods.allowance(this.loomUserAddress, loomBNBTransferGatewayAddress).call({ from: this.accountMapping.ethereum.local.toString() })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'Allowance checked. Next -> withdrawing BNB' })
    const bnbTokenAddress = Address.fromString(this.extdevNetworkConfig['chainId'] + ':' + this.loomBNBContract._address.toLowerCase())
    const tmp = this._decodeAddress(binanceAddress)
    const recipient = new Address('binance', new LocalAddress(tmp))
    await this.loomBNBGateway.withdrawTokenAsync(new BN(amountInt, 10), bnbTokenAddress, recipient)
    EventBus.$emit('updateStatus', { currentStatus: 'Withdrawn!' })
  }

  _decodeAddress (value) {
    const decodeAddress = bech32.decode(value)
    return Buffer.from(bech32.fromWords(decodeAddress.words))
  }

  async approveFee () {
    const fee = 37500
    EventBus.$emit('updateStatus', { currentStatus: 'Approving the gateway to take the BNB fee.' })
    const binanceTransferGatewayAddress = await this._getBinanceTransferGatewayAddress()
    await this.loomBNBContract.methods.approve(binanceTransferGatewayAddress, fee).send({ from: this.accountMapping.ethereum.local.toString() })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    while (approvedBalance == 0) {
      approvedBalance = await this.loomBNBContract.methods.allowance(this.loomUserAddress, binanceTransferGatewayAddress).call({ from: this.accountMapping.ethereum.local.toString() })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'Approved the gateway to take the BNB fee.' })
  }

  async _getBinanceTransferGatewayAddress () {
    const contractAddr = await this.client.getContractAddressAsync('binance-gateway')
    return contractAddr.local.toString()
  }
}

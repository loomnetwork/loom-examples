import {
  Address,
  Contracts
} from 'loom-js'
import { EventBus } from '../EventBus/EventBus'
import networkConfigs from '../../network-configs.json'
import { UniversalSigning } from '../UniversalSigning/UniversalSigning'
import PayableDemoJSON from '../../loom/build/contracts/PayableDemo.json'

const EthCoin = Contracts.EthCoin

export default class LoomEthCoin extends UniversalSigning {

  async load (web3Ethereum) {
    this.extdevNetworkConfig = networkConfigs.networks['extdev']
    const { web3Loom, accountMapping, client } = await super._load(web3Ethereum)
    this.accountMapping = accountMapping
    this.web3Ethereum = web3Ethereum
    this.web3Loom = web3Loom
    this.client = client
    await this._getContracts()
    setInterval(async () => {
      await this._updateBalances()
    }, 2000)
  }

  async _getContracts () {
    const payableDemoContractAddress = PayableDemoJSON.networks[this.extdevNetworkConfig['networkId']].address
    this.payableDemoContract = new this.web3Loom.eth.Contract(PayableDemoJSON.abi, payableDemoContractAddress)
    this.ethCoin = await EthCoin.createAsync(
      this.client,
      this.accountMapping.ethereum
    )
  }

  async _updateBalances () {
    const mainNetBalance = await this._getMainNetBalance()
    const loomBalance = await this._getLoomBalance()
    const payableDemoContractBalance = await this._getPayableDemoContractBalance()
    EventBus.$emit('updateBalance', { mainNetBalance: mainNetBalance, loomBalance: loomBalance, payableDemoContractBalance: payableDemoContractBalance })
  }

  async _getPayableDemoContractBalance () {
    const contractAddress = PayableDemoJSON.networks[this.extdevNetworkConfig['networkId']].address
    const wei = await this.ethCoin.getBalanceOfAsync(Address.fromString(`${this.client.chainId}:${contractAddress}`))
    return this.web3Ethereum.utils.fromWei(wei.toString(), 'ether')
  }

  async _getMainNetBalance () {
    const wei = await this.web3Ethereum.eth.getBalance(this.accountMapping.ethereum.local.toString())
    return this.web3Ethereum.utils.fromWei(wei.toString(), 'ether')
  }

  async _getLoomBalance () {
    const loomAddress = Address.fromString(this.accountMapping.loom.toString())
    const wei = await this.ethCoin.getBalanceOfAsync(loomAddress)
    return this.web3Loom.utils.fromWei(wei.toString(), 'ether')
  }

  async pay (amount) {
    const ethAddress = this.accountMapping.ethereum.local.toString()
    try {
      await this.payableDemoContract
        .methods
        .buySomething()
        .send({ from: ethAddress, value: this.web3Loom.utils.toWei(amount) })
    } catch (error) {
      console.log('Failed to call the buySomething function.')
      throw error
    }
  }
}

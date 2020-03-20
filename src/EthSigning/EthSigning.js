import { EventBus } from '../EventBus/EventBus'
import networkConfigs from '../../network-configs.json'
import { UniversalSigning } from '../UniversalSigning/UniversalSigning'
import SimpleStoreJSON from '../../loom/build/contracts/SimpleStore.json'

export default class EthSigning extends UniversalSigning {
  async load (web3Ethereum) {
    this.counter = 0
    this.extdevNetworkConfig = networkConfigs.networks['extdev']
    const { web3Loom, accountMapping, client } = await super._load(web3Ethereum)
    this.accountMapping = accountMapping
    this.web3Ethereum = web3Ethereum
    this.web3Loom = web3Loom
    this.client = client
    await this._getContract()
    await this._filterEvents()
    await this._setValue()
  }

  async _getContract () {
    this.contract = new this.web3Loom.eth.Contract(SimpleStoreJSON.abi, SimpleStoreJSON.networks[this.extdevNetworkConfig['networkId']].address)
  }

  async _setValue () {
    const ethAddress = this.accountMapping.ethereum.local.toString()
    const value = parseInt(this.counter, 10)
    try {
      await this.contract.methods
        .set(value)
        .send({
          from: ethAddress
        })
    } catch (error) {
      console.log(error.message)
    }
  }

  async increment () {
    this.info = 'Please sign the transaction.'
    this.counter += 1
    await this._setValue()
  }

  async decrement () {
    this.info = 'Please sign the transaction.'
    if (this.counter > 0) {
      this.counter -= 1
      await this._setValue()
    } else {
      console.log('counter should be >= 0.')
    }
  }

  async _filterEvents () {
    const loomAddress = this.accountMapping.loom.local.toString()
    this.contract.events.NewValueSet({ filter: { address: loomAddress } }, (err, event) => {
      if (err) {
        console.error('Error on event', err)
      } else {
        if (event.returnValues._value.toString() === this.counter.toString()) {
          const info = 'Looking good! Expected: ' + this.counter.toString() + ', Returned: ' + event.returnValues._value.toString()
          EventBus.$emit('updateValue', { info: info, counter: this.counter })
        } else {
          const info = 'An error occured! Expected: ' + this.counter.toString() + ', Returned: ' + event.returnValues._value.toString()
          EventBus.$emit('updateValue', { info: info, counter: this.counter })
        }
      }
    })
  }
}

import { EventBus } from './EventBus/EventBus'
import EthSigning from './EthSigning/EthSigning'
const Web3 = require('web3')
import Fortmatic from 'fortmatic'

var sample = new Vue({
  el: '#counter',
  data: {
    counter: 0,
    info: 'You will see a popup. Sign the transaction and wait a bit until it gets initialized...'
  },
  methods: {
    async  ethSigningDemo () {
      EventBus.$on('updateValue', this.updateValue)
      this.EthSigningDemo = new EthSigning()
      this.EthSigningDemo.load(this.web3js)
    },

    updateValue (data) {
      this.info = data.info
      this.counter = data.counter
    },

    async increment () {
      await this.EthSigningDemo.increment()
    },

    async decrement () {
      await this.EthSigningDemo.decrement()
    }
  },
  async mounted () {
    const fm = new Fortmatic('pk_test_68B049DC42D74C1C', 'rinkeby')
    this.web3js = new Web3(fm.getProvider())
    this.userAddress = await this.web3js.currentProvider.enable()
    await this.ethSigningDemo()
  }
})

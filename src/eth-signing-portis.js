
import Portis from '@portis/web3'
import { EventBus } from './EventBus/EventBus'
import EthSigning from './EthSigning/EthSigning'
const Web3 = require('web3')

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
    const portis = new Portis('2c275e48-a16c-43ff-9ca5-cc8fc045468a', 'rinkeby')
    await portis.showPortis()
    this.web3js = new Web3(portis.provider)
    await this.ethSigningDemo()
  }
})

import { EventBus } from './EventBus/EventBus'
import EthSigning from './EthSigning/EthSigning'
const Web3 = require('web3')

var sample = new Vue({
  el: '#counter',
  data: {
    counter: 0,
    info: 'You will see a Metamask popup. Sign the transaction and wait a bit until it gets initialized...'
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
    },

    async loadWeb3 () {
      if (window.web3) {
        window.web3 = new Web3(window.web3.currentProvider)
        this.web3js = new Web3(window.web3.currentProvider)
        await ethereum.enable()
      } else {
        alert('Metamask is not Enabled')
      }
    }
  },
  async mounted () {
    await this.loadWeb3()
    await this.ethSigningDemo()
  }
})

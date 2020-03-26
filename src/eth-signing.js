import { EventBus } from './EventBus/EventBus'
import EthSigning from './EthSigning/EthSigning'
const Web3 = require('web3')

Vue.use(Toasted)

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
      this.makeToast('Incrementing.')
      await this.EthSigningDemo.increment()
    },

    async decrement () {
      this.makeToast('Decrementing.')
      await this.EthSigningDemo.decrement()
    },

    async loadWeb3 () {
      if (window.web3) {
        window.web3 = new Web3(window.web3.currentProvider)
        this.web3js = new Web3(window.web3.currentProvider)
        await ethereum.enable()
      } else {
        this.makeToast('Metamask is not enabled.')
      }
      this.makeToast('Metamask is enabled.')
    },
    async makeToast (data) {
      Vue.toasted.show(data, {
        duration: 4000,
        type: 'info',
        action: {
          text: 'Dismiss',
          onClick: (e, toast) => {
            toast.goAway(0)
          }
        }
      })
    }
  },
  async mounted () {
    await this.loadWeb3()
    await this.ethSigningDemo()
  }
})

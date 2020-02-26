import { EventBus } from './EventBus/EventBus'
import LoomEthCoin from './LoomEthCoin/LoomEthCoin'
import PayableDemo from './PayableDemo/PayableDemo'
const Web3 = require('web3')

Vue.use(Toasted)

var sample = new Vue({
  el: '#payable-demo',
  data: {
    info: 'Wait a bit until it gets initialized',
    web3js: null

  },
  methods: {

    async testPayable () {
      const amount = '0.001'
      this._PayableDemo.pay(amount)
    },

    async _makeToast (data) {
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
    },

    async updateStatus (data) {
      const currentStatus = data.currentStatus
      this._makeToast(currentStatus)
    },

    async updateBalance (data) {
      this.info = 'Extdev ETH balance: ' + data.loomBalance + ', Rinkeby ETH balance: ' + data.mainNetBalance + ', PayableDemo contract balance: ' + data.payableDemoContractBalance
    },

    async PayableDemo () {
      EventBus.$on('updateBalance', this.updateBalance)
      // EventBus.$on('updateStatus', this.updateStatus)
      this.ethCoin = new LoomEthCoin()
      await this.ethCoin.load(this.web3js)
      this._PayableDemo = new PayableDemo()
      this._PayableDemo.load(this.web3js)
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
    await this.PayableDemo()
  }
})

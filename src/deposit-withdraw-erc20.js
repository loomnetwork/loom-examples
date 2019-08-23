import { EventBus } from './EventBus/EventBus'
import ERC20 from './ERC20/ERC20'
const Web3 = require('web3')

var sample = new Vue({
  el: '#erc20-deposit-withdraw',
  data: {
    info: 'Wait a bit until it gets initialized',
    web3js: null,

  },
  methods: {
    async init () {
    },

    async resumeWithdrawal () {
      await this._ERC20Demo.resumeWithdrawal()
    },

    async depositERC20 () {
      const amount = 50
      await this._ERC20Demo.depositERC20(amount)
    },

    async updateBalance (data) {
      await this._ERC20Demo._updateBalances()
      this.info = 'Rinkeby balance: ' + data.mainNetBalance + ', Extdev balance: ' + data.loomBalance
    },

    async withdrawERC20 () {
      const amount = 50
      await this._ERC20Demo.withdrawERC20(amount)
    },

    async depositAndWithdrawERC20Demo () {
      EventBus.$on('updateBalances', this.updateBalance)
      this._ERC20Demo = new ERC20()
      this._ERC20Demo.load(this.web3js)
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
    await this.depositAndWithdrawERC20Demo()
  }
})

import BEP2Coin from './bep2/BEP2Coin'
import BNBCoin from './bnb/BNBCoin'
import { EventBus } from './EventBus/EventBus'
const Web3 = require('web3')

Vue.use(Toasted)

var sample = new Vue({
  el: '#bep2-deposit-withdraw',
  data: {
    bep2Balance: 'Wait a bit until it gets initialized...',
    bnbBalance: 'Wait a bit until it gets initialized...',
    bep2Coin: null,
    bnbCoin: null,
    bep2LoomAddress: 'Wait a bit until it gets initialized...',
    binanceAddress: null
  },
  methods: {
    async depositWithdrawBEP2Example () {
      EventBus.$on('updateBNBBalance', this.updateBNBBalance)
      EventBus.$on('updateBEP2Balance', this.updateBEP2Balance)
      EventBus.$on('updateBep2LoomAddress', this.updateBep2LoomAddress)
      EventBus.$on('updateStatus', this.updateStatus)
      this.bep2Coin = new BEP2Coin()
      this.bep2Coin.load(this.web3js)
      this.bnbCoin = new BNBCoin()
      this.bnbCoin.load(this.web3js)
    },
    updateBep2LoomAddress (data) {
      let tempAddress = data.loomAddress.slice(2, data.loomAddress.length)
      tempAddress = 'loom' + tempAddress
      this.bep2LoomAddress = tempAddress
    },
    updateBEP2Balance (data) {
      this.bep2Balance = data.newBalance
    },
    updateBNBBalance (data) {
      this.bnbBalance = data.newBalance
    },
    updateStatus (data) {
      const currentStatus = data.currentStatus
      this.makeToast(currentStatus)
    },
    async withdrawBEP2 () {
      if ((this.binanceAddress === null) || (this.binanceAddress.length === 0)) {
        console.log('Binance Address should not be empty.')
        return
      }
      const amountToWithdraw = 5
      console.log('Withdrawing ' + amountToWithdraw + ' tokens to ' + this.binanceAddress)
      await this.bnbCoin.approveFee()
      console.log('Approved the transfer gateway to take the fee.')
      await this.bep2Coin.withdrawBEP2(this.binanceAddress, amountToWithdraw)
      console.log('Tokens withdrawn.')
    },
    async loadWeb3 () {
      if (window.web3) {
        window.web3 = new Web3(window.web3.currentProvider)
        this.web3js = new Web3(window.web3.currentProvider)
        await ethereum.enable()
      } else {
        alert('Metamask is not Enabled')
      }
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
    await this.depositWithdrawBEP2Example()
  }
})

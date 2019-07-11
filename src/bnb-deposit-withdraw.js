import BNBCoin from './bnb/BNBCoin'
import { EventBus } from './bnb/EventBus.js'

var sample = new Vue({
  el: '#bnb-deposit-withdraw',
  data: {
    bnbBalance: 'Wait a bit until it gets initialized...',
    bnbCoin: null,
    binanceAddress: null,
    loomAddress: null,
    howToDeposit: null,
    withdrawMessage: 'Note: This will withdraw approx 0.12 BNB.'
  },
  watch: {
    loomAddress: function () {
      this.howToDeposit = 'Go to testnet.binance.org. Next, transfer some BNB to the Extdev hot wallet address: tbnb1gc7azhlup5a34t8us84x6d0fluw57deuf47q9w. \
      Put your extdev address (' + this.loomAddress + ') in the memo field. \
      You extdev balance will get updated in a bit.'
    }
  },
  methods: {
    async depositWithdrawBNBExample () {
      EventBus.$on('updateBalance', this.updateBalance)
      EventBus.$on('loomAddress', this.updateLoomAddress)
      this.bnbCoin = new BNBCoin()
      this.bnbCoin.load()
    },
    updateBalance (data) {
      this.bnbBalance = 'BNB Balance: ' + data.newBalance
    },
    updateLoomAddress (data) {
      this.loomAddress = data.loomAddress
    },
    async withdrawBNB () {
      await this.bnbCoin.withdrawBNB(this.binanceAddress)
    }
  },
  async mounted () {
    await this.depositWithdrawBNBExample()
  }
})

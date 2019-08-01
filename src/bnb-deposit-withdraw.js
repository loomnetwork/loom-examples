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
    value: 0,
    max: 4,
    label: null,
    amountToWithdraw: null
  },
  watch: {
    loomAddress: function () {
      let tempAddress = this.loomAddress.slice(2, this.loomAddress.length)
      tempAddress = 'loom' + tempAddress
      this.howToDeposit = 'Go to testnet.binance.org. Next, transfer some BNB to the Extdev hot wallet address: tbnb1gc7azhlup5a34t8us84x6d0fluw57deuf47q9w. \
      Put your extdev address (' + tempAddress + ') in the memo field. \
      You extdev balance will get updated in a bit.'
    }
  },
  methods: {
    async depositWithdrawBNBExample () {
      EventBus.$on('updateBalance', this.updateBalance)
      EventBus.$on('loomAddress', this.updateLoomAddress)
      EventBus.$on('updateStatus', this.updateStatus)
      this.bnbCoin = new BNBCoin()
      this.bnbCoin.load()
    },
    updateBalance (data) {
      this.bnbBalance = 'BNB Balance: ' + data.newBalance
    },
    updateLoomAddress (data) {
      this.loomAddress = data.loomAddress
    },
    updateStatus (data) {
      const currentStatus = data.currentStatus
      const progress = {
        'waiting': { 'value': 0, 'label': 'Waiting.' },
        'approving': { 'value': 1, 'label': 'Approving.' },
        'approved': { 'value': 2, 'label': 'Approved. Next -> Checking the allowance.' },
        'allowanceChecked': { 'value': 3, 'label': 'Allowance checked. Next -> Withdrawing BNB' },
        'withdrawn': { 'value': 4, 'label': 'Succesfully withdrawn!' }
      }
      this.value = progress[currentStatus]['value']
      this.label = progress[currentStatus]['label']
    },
    async withdrawBNB () {
      if ((this.binanceAddress === null) || (this.binanceAddress.length === 0)) {
        console.log('Binance Address should not be empty.')
        return
      }
      if (this.amountToWithdraw === null) {
        console.log('Amount should not be empty.')
        return
      }
      const amount = this.amountToWithdraw.replace(',', '.')
      if (isNaN(amount)) {
        console.log('Amount to withdraw should be a valid number.')
        return
      }
      await this.bnbCoin.withdrawBNB(this.binanceAddress, amount)
    }
  },
  async mounted () {
    await this.depositWithdrawBNBExample()
  }
})

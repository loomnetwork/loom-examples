import BEP2Coin from './bep2/BEP2Coin'
import AsiaBNBCoin from './AsiaBNBCoin/AsiaBNBCoin'
import { EventBus } from './EventBus/EventBus'

var sample = new Vue({
  el: '#bep2-deposit-withdraw',
  data: {
    bep2Balance: 'Wait a bit until it gets initialized...',
    bnbBalance: 'Wait a bit until it gets initialized...',
    bep2Coin: null,
    asiaBNBCoin: null,
    bep2LoomAddress: 'Wait a bit until it gets initialized...',
    binanceAddress: null,
    value: 0,
    max: 7,
    label: null
  },
  methods: {
    async depositWithdrawBEP2Example () {
      EventBus.$on('updateBNBBalance', this.updateBNBBalance)
      EventBus.$on('updateBEP2Balance', this.updateBEP2Balance)
      EventBus.$on('updateBep2LoomAddress', this.updateBep2LoomAddress)
      EventBus.$on('updateStatus', this.updateStatus)
      this.bep2Coin = new BEP2Coin()
      this.bep2Coin.load()
      this.asiaBNBCoin = new AsiaBNBCoin()
      this.asiaBNBCoin.load()
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
      const progress = {
        'waiting': { 'value': 0, 'label': 'Waiting.' },
        'bnbApproving': { 'value': 1, 'label': 'Approving the gateway to take the fee.' },
        'bnbApproved': { 'value': 2, 'label': 'Approved. Next -> Checking the allowance.' },
        'bnbWithdrawn': { 'value': 3, 'label': 'Succesfully approved!. Next -> Approving the gateway to take the tokens' },

        'bep2Approving': { 'value': 4, 'label': 'Approving the gateway to take the tokens.' },
        'bep2Approved': { 'value': 5, 'label': 'Approved. Next -> Checking the allowance.' },
        'bep2AllowanceChecked': { 'value': 6, 'label': 'Allowance checked. Next -> Withdrawing tokens to Binance.' },
        'bep2Withdrawn': { 'value': 7, 'label': 'Succesfully withdrawn!' }
      }
      this.value = progress[currentStatus]['value']
      this.label = progress[currentStatus]['label']
    },
    async withdrawBEP2 () {
      if ((this.binanceAddress === null) || (this.binanceAddress.length === 0)) {
        console.log('Binance Address should not be empty.')
        return
      }
      const amountToWithdraw = 5
      console.log('Withdrawing ' + amountToWithdraw + ' to ' + this.binanceAddress)
      await this.asiaBNBCoin.approveFee()
      console.log('Approved the transfer gateway to take the fee.')
      await this.bep2Coin.withdrawBEP2(this.binanceAddress, amountToWithdraw)
      console.log('Tokens withdrawn.')
    }
  },
  async mounted () {
    await this.depositWithdrawBEP2Example()
  }
})

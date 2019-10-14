import BinanceExtdevRinkeby from './bep2/BinanceExtdevRinkeby'
import BNBCoin from './bnb/BNBCoin'
import LoomEthCoin from './LoomEthCoin/LoomEthCoin'
import { EventBus } from './EventBus/EventBus'

Vue.use(Toasted)

const Web3 = require("web3");

var sample = new Vue({
  el: '#binance-loom-ethereum',
  data: {
    rinkebyBep2CoinBalance: 'Wait a bit until it gets initialized...',
    rinkebyEthBalance: 'Wait a bit until it gets initialized...',
    extdevEthBalance: 'Wait a bit until it gets initialized...',
    extdevBep2CoinBalance: 'Wait a bit until it gets initialized...',
    extdevBnbCoinBalance: 'Wait a bit until it gets initialized...',
    extdevUserAddress: 'Wait a bit until it gets initialized...',
    extdevHotWalletAddress: 'tbnb1gc7azhlup5a34t8us84x6d0fluw57deuf47q9w',
    binanceAddress: null
  },
  methods: {
    async binanceLoomEthereumExample () {
      EventBus.$on('updateBNBBalance', this.updateBNBBalance)
      EventBus.$on('updateBEP2Balance', this.updateBEP2Balance)
      EventBus.$on('updateEthBalance', this.updateEthBalance)
      EventBus.$on('updateStatus', this.updateStatus)
      EventBus.$on('updateExtdevUserAddress', this.updateExtdevUserAddress)
      this.bep2Coin = new BinanceExtdevRinkeby()
      await this.bep2Coin.load(this.web3js)
      this.bnbCoin = new BNBCoin()
      await this.bnbCoin.load(this.web3js)
      this.ethCoin = new LoomEthCoin()
      await this.ethCoin.load(this.web3js)
    },
    updateExtdevUserAddress (data) {
      let tempAddress = data.extdevUserAddress.slice(2, data.extdevUserAddress.length)
      tempAddress = 'loom' + tempAddress
      this.extdevUserAddress = tempAddress
    },
    updateBEP2Balance (data) {
      this.extdevBep2CoinBalance = data.loomBep2Balance
      this.rinkebyBep2CoinBalance = data.rinkebyBep2Balance
    },
    updateBNBBalance (data) {
      this.extdevBnbCoinBalance = data.newBalance
    },
    updateEthBalance (data) {
      this.extdevEthBalance = data.loomBalance
      this.rinkebyEthBalance = data.mainNetBalance
    },
    updateStatus (data) {
      const currentStatus = data.currentStatus
      this.makeToast(currentStatus)
    },

    async withdrawToBinance () {
      if ((this.binanceAddress === null) || (this.binanceAddress.length === 0)) {
        console.log('Binance Address should not be empty.')
        return
      }
      const amountToWithdraw = 5
      console.log('Withdrawing ' + amountToWithdraw + ' tokens to ' + this.binanceAddress)
      await this.bnbCoin.approveFee()
      console.log('Approved the transfer gateway to take the fee.')
      await this.bep2Coin.withdrawToBinance(this.binanceAddress, amountToWithdraw)
      console.log('Tokens withdrawn.')
    },
    async withdrawToEthereum () {
      const amount = 5
      await this.ethCoin.approveFee()
      this.bep2Coin.withdrawToEthereum(amount)
    },
    async depositToLoom () {
      const amount = 5
      this.bep2Coin.depositToLoom(amount)
    },
    async resumeLoomToEthereum () {
      this.bep2Coin.resumeWithdrawal()
    },
    async loadWeb3 () {
      if (window.web3) {
        window.web3 = new Web3(window.web3.currentProvider)
        this.web3js = new Web3(window.web3.currentProvider)
        await ethereum.enable()
      } else {
        alert("Metamask is not Enabled")
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
    await this.binanceLoomEthereumExample()
  }
})

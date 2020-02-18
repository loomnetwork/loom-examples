import { EventBus } from './EventBus/EventBus'
import LoomEthCoin from './LoomEthCoin/LoomEthCoin'
import ERC721 from './ERC721/ERC721'
const Web3 = require('web3')

Vue.use(Toasted)

var sample = new Vue({
  el: '#erc721-deposit-withdraw',
  data: {
    info: 'Wait a bit until it gets initialized',
    web3js: null

  },
  methods: {
    async init () {
    },

    async resumeWithdrawal () {
      await this._ERC721Demo.resumeWithdrawal()
    },

    async depositERC721 () {
      const tokenId = 1
      await this._ERC721Demo.depositERC721(tokenId)
    },

    getTokenState (loomBalance, mainNetBalance) {
      if (loomBalance == 1 && mainNetBalance == 1) {
        return 'IN_TRANSFER'
      }
      if (loomBalance == 0 && mainNetBalance == 0) {
        return 'IN_TRANSFER'
      }
      if (loomBalance == 1 && mainNetBalance == 0 ) {
        return 'ON_LOOM'
      }
      if (loomBalance == 0 && mainNetBalance == 1 ) {
        return 'ON_RINKEBY'
      }
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
      await this._ERC721Demo._updateBalances()
      const loomBalance = data.loomBalance
      const mainNetBalance = data.mainNetBalance
      const tokenState = this.getTokenState(loomBalance, mainNetBalance)
      switch (tokenState) {
        case 'ON_LOOM':
          this.info = 'Your token is on Loom. Press the Withdraw button to transfer it to Rinkeby.'
          document.getElementById('deposit').disabled = true
          document.getElementById('withdraw').disabled = false
          break
        case 'ON_RINKEBY':
          this.info = 'Your token is on Rinkeby. Press the Deposit button to transfer it to Loom.'
          document.getElementById('deposit').disabled = false
          document.getElementById('withdraw').disabled = true
          break
        case 'IN_TRANSFER':
          document.getElementById('withdraw').disabled = true
          document.getElementById('deposit').disabled = true
          this.info = 'Your token is being transferred through the Transfer Gateway.'
          break
      }
    },

    async withdrawERC721 () {
      const tokenId = 1
      await this.ethCoin.approveFee()
      await this._ERC721Demo.withdrawERC721(tokenId)
    },

    async depositAndWithdrawERC721Demo () {
      EventBus.$on('updateBalances', this.updateBalance)
      EventBus.$on('updateStatus', this.updateStatus)
      this.ethCoin = new LoomEthCoin()
      await this.ethCoin.load(this.web3js)
      this._ERC721Demo = new ERC721()
      this._ERC721Demo.load(this.web3js)
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
    await this.depositAndWithdrawERC721Demo()
  }
})

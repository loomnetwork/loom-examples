import { ethers } from "ethers";
import GatewayJSON from "../truffle/build/contracts/Gateway.json";
import {
  NonceTxMiddleware,
  SignedEthTxMiddleware,
  CryptoUtils,
  Client,
  LoomProvider,
  Address,
  LocalAddress,
  Contracts,
  EthersSigner,
  createDefaultTxMiddleware
} from "loom-js";

import LoomEthCoin  from './LoomEthCoin/LoomEthCoin'
import { EventBus } from './LoomEthCoin/EventBus'

const Web3 = require("web3");
const BN = require("bn.js");
const EthCoin = Contracts.EthCoin;

var sample = new Vue({
  el: "#eth-deposit-withdraw",
  data: {
    info: "Wait a bit until it gets initialized",
    web3js: null,
    loomEthCoinDemo: null
  },
  methods: {
    async depositAndWithdrawEthersDemo () {
      EventBus.$on('updateBalances', this.updateBalance)
      this.loomEthCoinDemo = new LoomEthCoin()
      this.loomEthCoinDemo.load(this.web3js)
    },
    async updateBalance (data) {
      await this.loomEthCoinDemo._updateBalances()
      this.info = 'Rinkeby balance: ' + data.mainNetBalance + ', Extdev balance: ' + data.loomBalance
    },
    async depositEth () {
      this.loomEthCoinDemo.depositEth()
    },
    async withdrawEth () {
      this.loomEthCoinDemo.withdrawEth()
    },
    async resumeWithdrawal () {

    },
    async loadWeb3 () {
      if (window.web3) {
        window.web3 = new Web3(window.web3.currentProvider)
        this.web3js = new Web3(window.web3.currentProvider)
        await ethereum.enable()
      } else {
        alert("Metamask is not Enabled")
      }
    }
  },
  async mounted () {
    await this.loadWeb3()
    await this.depositAndWithdrawEthersDemo()
  }
})

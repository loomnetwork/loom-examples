import {
  ethers
} from 'ethers'
import MainNetCoinJSON from '../truffle/build/contracts/MyMainNetCoin.json'
import LoomCoinJSON from '../truffle/build/contracts/MyLoomCoin.json'
import GatewayJSON from '../truffle/build/contracts/Gateway.json'
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
  createDefaultTxMiddleware,
} from 'loom-js'

const Web3 = require('web3')
const BN = require('bn.js')

var sample = new Vue({
  el: '#erc20-deposit-withdraw',
  data: {
    counter: 0,
    info: 'Wait a bit until it gets initialized',
    web3js: null,
    chainId: 'extdev-plasma-us1',
    writeUrl: 'wss://extdev-plasma-us1.dappchains.com/websocket',
    readUrl: 'wss://extdev-plasma-us1.dappchains.com/queryws',
    networkId: 9545242630824,
    callerChainId: 'eth',
    ethAddress: null,
    client: null,
    loomProvider: null,
    contract: null,
    loomGatewayAddress: '0xE754d9518bF4a9C63476891eF9Aa7D91c8236a5d',
    mainNetGatewayAddress: '0xb73C9506cb7f4139A4D6Ac81DF1e5b6756Fab7A2',
    loomAddress: null,
    rinkebyNetworkId: 4,
    mainNetCoinContractAddress: null,
    mainNetCoinContract: null,
    mainNetCoinSymbol: null,
    loomCoinContractAddress: null,
    loomCoinContract: null,
    mainNetGatewayContract: null,
    web3loom: null
  },
  methods: {
    async init () {
      this.client = new Client(
        this.chainId,
        this.writeUrl,
        this.readUrl
      )
      const provider = this.web3js.currentProvider
      provider.isMetaMask = true
      const ethersProvider = new ethers.providers.Web3Provider(provider)
      const signer = ethersProvider.getSigner()
      this.ethAddress = await signer.getAddress()
      const to = new Address('eth', LocalAddress.fromHexString(this.ethAddress))
      const privateKey = CryptoUtils.generatePrivateKey()
      const publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
      this.client.txMiddleware = createDefaultTxMiddleware(this.client, privateKey)
      const addressMapper = await Contracts.AddressMapper.createAsync(
        this.client,
        new Address(this.client.chainId, LocalAddress.fromPublicKey(publicKey))
      )
      if (await addressMapper.hasMappingAsync(to)) {
        console.log('Mapping already exists.')
        const mapping = await addressMapper.getMappingAsync(to)
        console.log('mapping.to: ' + mapping.to.local.toString())
        console.log('mapping.from: ' + mapping.from.local.toString())
        this.loomAddress = mapping.to.local.toString()
      } else {
        const from = new Address(this.client.chainId, LocalAddress.fromPublicKey(publicKey))
        console.log('Mapping ' + from + ' and ' + to)
        const ethersSigner = new EthersSigner(signer)
        await addressMapper.addIdentityMappingAsync(from, to, ethersSigner)
        const mapping = await addressMapper.getMappingAsync(to)
        console.log('mapping.to: ' + mapping.to.local.toString())
        console.log('mapping.from: ' + mapping.from.local.toString())
        this.loomAddress = mapping.to.local.toString()
      }
      this.loomProvider = new LoomProvider(this.client, privateKey)
      this.loomProvider.callerChainId = this.callerChainId
      this.loomProvider.setMiddlewaresForAddress(to.local.toString(), [
        new NonceTxMiddleware(
          new Address(this.callerChainId, LocalAddress.fromHexString(this.ethAddress)),
          this.client
        ),
        new SignedEthTxMiddleware(signer)
      ])
      return true
    },

    async getMainNeCoinContract () {
      this.mainNetCoinContractAddress = MainNetCoinJSON.networks[this.rinkebyNetworkId].address
      this.mainNetCoinContract = await new this.web3js.eth.Contract(MainNetCoinJSON.abi, this.mainNetCoinContractAddress)
    },

    async getWeb3Loom () {
      this.web3loom = new Web3(this.loomProvider)
    },

    async getLoomCoinContract () {
      this.loomCoinContractAddress = LoomCoinJSON.networks[this.networkId].address
      this.loomCoinContract = new this.web3loom.eth.Contract(LoomCoinJSON.abi, this.loomCoinContractAddress)
    },

    async getMainNetGatewayContract () {
      this.mainNetGatewayContract = await new this.web3js.eth.Contract(GatewayJSON.abi, this.mainNetGatewayAddress)
    },

    async getMainNetCoinBalance () {
      const loomWei = await this.mainNetCoinContract.methods
        .balanceOf(this.ethAddress)
        .call({
          from: this.ethAddress
        })
      const balance = this.web3js.utils.fromWei(loomWei.toString(), 'ether')
      let limitDecimals = parseFloat(balance).toFixed(2)
      return limitDecimals
    },

    async getLoomCoinContractBalance () {
      const loomWei = await this.loomCoinContract.methods
        .balanceOf(this.loomAddress)
        .call({
          from: this.ethAddress
        })
      const balance = this.web3loom.utils.fromWei(loomWei.toString(), 'ether')
      let limitDecimals = parseFloat(balance).toFixed(2)
      return limitDecimals
    },

    async depositCoins (transferAmount) {
      const amount = web3.utils.toWei(transferAmount.toString(), 'ether')
      console.log('Calling approve.')
      try {
        await this.mainNetCoinContract.methods.approve(this.mainNetGatewayAddress, amount).send({ from: this.ethAddress })
      } catch (error) {
        console.log('Failed to approve Ethereum Gateway to take the coin.')
        throw error
      }
      console.log('Calling depositERC20.')
      try {
        await this.mainNetGatewayContract.methods.depositERC20(amount, this.mainNetCoinContractAddress).send({ from: this.ethAddress, gas: '489362' })
      } catch (error) {
        console.log('Failed to transfer coin to the Ethereum Gateway')
        throw error
      }
      console.log('Coins deposited.')
    },

    async transferCoinsToLoomGateway (amountToTransfer) {
      try {
        let amount = this.web3js.utils.toWei(amountToTransfer.toString(), 'ether')
        const dAppChainGatewayAddr = this.web3loom.utils.toChecksumAddress(this.loomGatewayAddress)
        await this.loomCoinContract.methods
          .approve(dAppChainGatewayAddr, amount)
          .send({ from: this.ethAddress })
        const timeout = 60 * 1000
        const ownerMainnetAddr = Address.fromString('eth:' + this.ethAddress)
        const tokenAddress = Address.fromString(this.chainId + ':' + this.loomCoinContractAddress)
        const userLocalAddr = Address.fromString(this.chainId + ':' + this.loomAddress)
        let gatewayContract = await Contracts.TransferGateway.createAsync(
          this.client,
          userLocalAddr
        )
        const receiveSignedWithdrawalEvent = new Promise((resolve, reject) => {
          let timer = setTimeout(
            () => reject(new Error('Timeout while waiting for withdrawal to be signed')),
            timeout
          )
          const listener = event => {
            const tokenEthAddress = Address.fromString('eth:' + this.mainNetCoinContractAddress)
            if (
              event.tokenContract.toString() === tokenEthAddress.toString() &&
            event.tokenOwner.toString() === ownerMainnetAddr.toString()
            ) {
              clearTimeout(timer)
              timer = null
              gatewayContract.removeAllListeners(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL)
              console.log('Oracle signed tx ', CryptoUtils.bytesToHexAddr(event.sig))
              resolve(event)
            }
          }
          gatewayContract.on(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL, listener)
        })
        await gatewayContract.withdrawERC20Async(
          new BN(amount, 10),
          tokenAddress,
          ownerMainnetAddr
        )
        await receiveSignedWithdrawalEvent
      } catch (error) {
        throw error
      }
    },

    async getWithdrawalReceipt () {
      const userLocalAddr = Address.fromString(this.chainId + ':' + this.loomAddress)
      let gatewayContract = await Contracts.TransferGateway.createAsync(
        this.client,
        userLocalAddr
      )
      const data = await gatewayContract.withdrawalReceiptAsync(userLocalAddr)
      if (!data) {
        return null
      }
      const signature = CryptoUtils.bytesToHexAddr(data.oracleSignature)
      return {
        signature: signature,
        amount: data.value.toString(10),
        tokenContract: data.tokenContract.local.toString()
      }
    },

    async withdrawCoinsFromMainNetGateway (data) {
      const tx = await this.mainNetGatewayContract.methods
        .withdrawERC20(data.amount.toString(), data.signature, MainNetCoinJSON.networks[this.rinkebyNetworkId].address)
        .send({ from: this.ethAddress })
      console.log(`${data.amount} tokens withdrawn from MainNet Gateway.`)
      console.log(`Rinkeby tx hash: ${tx.transactionHash}`)
    },

    async resumeWithdrawal () {
      const amount = 500
      const data = await this.getWithdrawalReceipt()
      if (data != undefined) {
        await this.withdrawCoinsFromMainNetGateway(amount, data)
      }
    },

    async depositERC20 () {
      const amount = 500
      await this.depositCoins(amount)
    },

    async refreshBalances () {
      this.info = 'Refreshing balances.'
      this.info = 'MainNet balance: ' + await this.getMainNetCoinBalance() + ', Loom balance: ' + await this.getLoomCoinContractBalance()
    },

    async withdrawERC20 () {
      const amount = 500
      console.log('Transferring to Loom Gateway.')
      await this.transferCoinsToLoomGateway(amount)
      console.log('Getting withdrawal receipt')
      let data = await this.getWithdrawalReceipt()
      console.log('Withdrawing from MainNet Gateway')
      await this.withdrawCoinsFromMainNetGateway(data)
    },

    async depositAndWithdrawERC20Demo () {
      if (await this.init()) {
        await this.getWeb3Loom()
        await this.getMainNeCoinContract()
        await this.getLoomCoinContract()
        await this.getMainNetGatewayContract()
        await this.refreshBalances()
        await this.filterEvents()
      }
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
    async filterEvents () {
      this.loomCoinContract.events.Transfer({ filter: { address: this.loomAddress } }, async (err, event) => {
        if (err) console.error('Error on event', err)
        await this.refreshBalances()
      })
      this.mainNetCoinContract.events.Transfer({ filter: { address: this.ethAddress } }, async (err, event) => {
        if (err) console.error('Error on event', err)
        await this.refreshBalances()
      })
    }
  },

  async mounted () {
    await this.loadWeb3()
    await this.depositAndWithdrawERC20Demo()
  }
})

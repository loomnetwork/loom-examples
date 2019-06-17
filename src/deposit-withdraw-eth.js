import {
  ethers
} from 'ethers'
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
  createDefaultTxMiddleware
} from 'loom-js'

const Web3 = require('web3')
const BN = require('bn.js')
const EthCoin = Contracts.EthCoin

var sample = new Vue({
  el: '#eth-deposit-withdraw',
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
    publicKey: null,
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
      const privateKey = CryptoUtils.generatePrivateKey()
      this.publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
      this.client = new Client(
        this.chainId,
        this.writeUrl,
        this.readUrl
      )
      const ethersProvider = new ethers.providers.Web3Provider(this.web3js.currentProvider)
      const signer = ethersProvider.getSigner()
      this.ethAddress = await signer.getAddress()
      const to = new Address('eth', LocalAddress.fromHexString(this.ethAddress))
      const from = new Address(this.client.chainId, LocalAddress.fromPublicKey(this.publicKey))
      this.client.txMiddleware = createDefaultTxMiddleware(this.client, privateKey)
      const addressMapper = await Contracts.AddressMapper.createAsync(
        this.client,
        new Address(this.client.chainId, LocalAddress.fromPublicKey(this.publicKey))
      )
      if (await addressMapper.hasMappingAsync(to)) {
        const mapping = await addressMapper.getMappingAsync(to)

        if (mapping.to.local.toString() != from.local.toString()) {
          console.log('Mapping mismatch. ' + mapping.from + ' is already mapped to ' + mapping.to)
          return false
        }
        console.log(mapping.from + ' already mapped to ' + mapping.to)
        this.loomAddress = mapping.to.local.toString()
      } else {
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

    async getMainNetGatewayContract () {
      this.mainNetGatewayContract = await new this.web3js.eth.Contract(GatewayJSON.abi, this.mainNetGatewayAddress)
    },

    async getMainNetEthBalance () {
      const wei = await web3.eth.getBalance(this.ethAddress)
      return web3.utils.fromWei(wei.toString(), 'ether')
    },

    async getLoomEthBalance () {
      /* const web3 = new Web3(this.loomProvider)
      const wei = await web3.eth.getBalance(this.loomAddress)
      return web3.utils.fromWei(wei.toString(), 'ether') */
      const addr = Address.fromString(`${this.client.chainId}:${this.loomAddress}`)
      const ethCoin = await EthCoin.createAsync(this.client, addr)
      const wei = await ethCoin.getBalanceOfAsync(addr)
      return web3.utils.fromWei(wei.toString(), 'ether')
    },

    async depositEth () {
      const amount = 2500000
      const addressFrom = this.ethAddress.toString()
      const gasLimit = this.web3js.utils.toHex(25000)
      const gasPrice = this.web3js.utils.toHex(10e9)
      try {
        await this.web3js.eth.sendTransaction({
          from: addressFrom,
          to: this.mainNetGatewayAddress,
          value: amount,
          gasLimit: gasLimit,
          gasPrice: gasPrice
        })
      } catch (error) {
        console.log(error)
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

    async transferEthToLoomGateway (amount) {
      const ownerLoomAddr = new Address(
        this.chainId,
        LocalAddress.fromHexString(this.loomAddress)
      )
      const gatewayContract = await Contracts.TransferGateway.createAsync(this.client, ownerLoomAddr)
      const ethCoin = await EthCoin.createAsync(this.client, ownerLoomAddr)
      const loomGatewayAddr = Address.fromString(`${this.client.chainId}:${this.loomGatewayAddress}`)
      await ethCoin.approveAsync(loomGatewayAddr, new BN(amount))

      const ownerMainNetAddr = Address.fromString(`eth:${this.ethAddress}`)
      const mainNetGatewayAddr = Address.fromString(`eth:${this.mainNetGatewayAddress}`)
      const timeout = 60 * 1000
      const receiveSignedWithdrawalEvent = new Promise((resolve, reject) => {
        let timer = setTimeout(
          () => reject(new Error('Timeout while waiting for withdrawal to be signed')),
          timeout
        )
        const listener = event => {
          if (
            event.tokenContract.toString() === mainNetGatewayAddr.toString() &&
            event.tokenOwner.toString() === ownerMainNetAddr.toString()
          ) {
            clearTimeout(timer)
            timer = null
            gatewayContract.removeAllListeners(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL)
            resolve(event)
          }
        }
        gatewayContract.on(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL, listener)
      })
      await gatewayContract.withdrawETHAsync(new BN(amount), mainNetGatewayAddr, ownerMainNetAddr)
      console.log(`${amount.toString()} wei deposited to DAppChain Gateway...`)
      await receiveSignedWithdrawalEvent
      //const event = await receiveSignedWithdrawalEvent
      // return CryptoUtils.bytesToHexAddr(event.sig)
    },

    async withdrawEthFromMainNetGateway (amount, data) {
      const gas = 350000
      console.log(data)
      const gatewayContract = this.mainNetGatewayContract
      const gasEstimate = gatewayContract.methods
        .withdrawETH(amount.toString(), data.signature)
        .estimateGas({ from: this.ethAddress, gas })
      if (gasEstimate == gas) {
        throw new Error('Not enough enough gas, send more.')
      }
      return gatewayContract.methods
        .withdrawETH(amount.toString(), data.signature)
        .send({ from: this.ethAddress })
    },

    async refreshBalances () {
      this.info = 'Refreshing balances.'
      this.info = 'MainNetEth balance: ' + await this.getMainNetEthBalance() + ', LoomEth balance: ' + await this.getLoomEthBalance()
    },

    async withdrawEth () {
      const amount = 2500000
      await this.transferEthToLoomGateway(amount)
      const data = await this.getWithdrawalReceipt()
      if (data != undefined) {
        await this.withdrawEthFromMainNetGateway(amount, data)
      }
    },

    async resumeWithdrawal () {
      const amount = 2500000
      const data = await this.getWithdrawalReceipt()
      if (data != undefined) {
        await this.withdrawEthFromMainNetGateway(amount, data)
      }
    },

    async depositAndWithdrawEthersDemo () {
      if (await this.init()) {
        await this.getMainNetGatewayContract()
        await this.refreshBalances()
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
    }
  },
  async mounted () {
    await this.loadWeb3()
    await this.depositAndWithdrawEthersDemo()
  }
})

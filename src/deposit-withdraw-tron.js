import { CryptoUtils, Client, LocalAddress, LoomProvider, Contracts, TronWebSigner, Address, createDefaultTxMiddleware } from 'loom-js'
import erc20abi from '../truffle/build/contracts/TRXToken.json'
import BN from 'bn.js'

const Web3 = require('web3')
const AddressMapper = Contracts.AddressMapper

const TRX_AMOUNT = 1000000
const TRX_COIN_ADDRESS_HEX = '0x341a5f1ce363cc891b091ea2c7bd225ca0e4030d'
const TRX_GATEWAY_ADDRESS = '4138c95ff1e0a06660a1ba46a5821b52bdc0f09845'
const LOOM_GATEWAY_ADDRESS = '0xfc1d63e641cb9fba89956f4858bf7f2e51535102'
const TRON_DAPP_ADDRESS = '0x0000000000000000000000000000000000000001'

var sample = new Vue({
  el: '#tron-deposit-withdraw',
  data: {
    info: 'Wait a bit until it gets initialized',
    tronWeb: null,
    tronAddrBase58: null,
    client: null,
    chainId: 'default',
    writeUrl: 'wss://test-z-us1.dappchains.com/websocket',
    readUrl: 'wss://test-z-us1.dappchains.com/queryws',
    loomWeb3: null,
    loomGateway: null,
    tronGateway: null,
    loomLocalAddress: null,
    loomTRX: null,
    loomAddressInHex: null,
    trxAddrObj: null
  },
  methods: {
    async init () {
      const privateKey = this.getPrivateKey()
      const publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
      const loomAddress = LocalAddress.fromPublicKey(publicKey)
      this.loomAddressInHex = loomAddress.toString()
      const tronAddrInHex = this.tronWeb.address.toHex(this.tronAddrBase58)
      const trxAddress = '0x' + tronAddrInHex.substring(2, 100)
      this.trxAddrObj = Address.fromString(`tron:${trxAddress}`)

      this.client = new Client(
        this.chainId,
        this.writeUrl,
        this.readUrl
      )
      this.client.txMiddleware = createDefaultTxMiddleware(this.client, privateKey)

      this.loomWeb3 = new Web3(new LoomProvider(this.client, privateKey))
      this.loomLocalAddress = new Address(this.client.chainId, loomAddress)
      const signer = new TronWebSigner(this.tronWeb, trxAddress)

      const addressMapper = await AddressMapper.createAsync(this.client, this.loomLocalAddress)

      if (!(await addressMapper.hasMappingAsync(this.loomLocalAddress))) {
        try {
          await addressMapper.addIdentityMappingAsync(
            this.loomLocalAddress,
            this.trxAddrObj,
            signer
          )
        } catch (error) {
          console.log('This Loom account has been mapped to a different Tron address.')
          throw (error)
        }
      } else {
        console.log('Address mapping already exists.')
      }
    },
    getPrivateKey () {
      let privateKey = localStorage.getItem('loom_pk')
      if (!privateKey) {
        privateKey = CryptoUtils.generatePrivateKey()
        localStorage.setItem('loom_pk', JSON.stringify(Array.from(privateKey)))
      } else {
        privateKey = new Uint8Array(JSON.parse(privateKey))
      }
      return privateKey
    },
    async getLoomTRXContract () {
      this.loomTRX = new this.loomWeb3.eth.Contract(erc20abi.abi, TRX_COIN_ADDRESS_HEX)
    },
    async getLoomGatewayContract () {
      this.loomGateway = await Contracts.TronTransferGateway.createAsync(
        this.client,
        this.loomLocalAddress
      )
    },

    async getTronGatewayContract () {
      this.tronGateway = await this.getContract(TRX_GATEWAY_ADDRESS)
    },

    async getContract (address) {
      const res = await this.tronWeb.contract().at(address)
      return res
    },
    async refreshBalance () {
      const loomBalance = await this.loomTRX.methods.balanceOf(this.loomAddressInHex).call({ from: this.loomAddressInHex })
      const shastaBalance = await this.tronWeb.trx.getBalance(this.tronAddrBase58)
      this.info = 'Refreshing balances.'
      this.info = 'LoomTRX balance: ' + loomBalance + ' Shasta TRX balance: ' + shastaBalance
    },
    async depositTRX () {
      await this.tronGateway.sendToken().send({ 'from': this.tronAddrBase58, 'callValue': TRX_AMOUNT })
    },
    async withdrawTRX () {
      await this.loomTRX.methods.approve(LOOM_GATEWAY_ADDRESS, TRX_AMOUNT).send({ from: this.loomAddressInHex })
      let approvedBalance = 0
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
      while (approvedBalance == 0) {
        approvedBalance = await this.loomTRX.methods.allowance(this.loomAddressInHex, LOOM_GATEWAY_ADDRESS).call({ from: this.loomAddressInHex })
        delay(5000)
      }

      const timeout = 60 * 1000
      const gatewayContract = this.loomGateway
      const receiveSignedWithdrawalEvent = new Promise((resolve, reject) => {
        let timer = setTimeout(
          () => reject(new Error('Timeout while waiting for withdrawal to be signed')),
          timeout
        )
        const listener = event => {
          console.log('receiveSignedWithdrawalEvent resolved')

          if (
            event.tokenContract.local.toString() === TRON_DAPP_ADDRESS &&
            event.tokenOwner.toString() === this.trxAddrObj.toString()
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

      let receipt
      let sig
      try {
        let trxTokenAddress = Address.fromString('default:' + this.loomTRX._address.toLowerCase())
        receipt = await this.loomGateway.withdrawTRXAsync(new BN(TRX_AMOUNT, 10), trxTokenAddress, this.trxAddrObj)
      } catch (err) {
        console.log('error withdrawing TRX: ', err)
        try {
          receipt = await this.loomGateway.withdrawalReceiptAsync(Address.fromString('default:' + this.loomAddressInHex))
          sig = receipt.oracleSignature
        } catch (err2) {
          console.log(err2)
        }
      }

      await receiveSignedWithdrawalEvent
      this.resumeWithdrawal()
    },

    async getWithdrawalReceipt () {
      try {
        let data = await this.loomGateway.withdrawalReceiptAsync(this.loomLocalAddress)
        if (!data) return null
        let signature = CryptoUtils.bytesToHexAddr(data.oracleSignature)
        return {
          signature: signature,
          amount: data.value.toString(10),
          tokenContract: data.tokenContract.local.toString()
        }
      } catch (error) {
        throw error
      }
    },
    async resumeWithdrawal () {
      const { signature, amount, tokenContract } = await this.getWithdrawalReceipt()
      let sig = signature
      if (sig.length > 132) {
        let byteToOmit = sig.length - 132 + 2 // +2 from `0x`
        sig = sig.slice(byteToOmit)
        sig = '0x' + sig
      }

      const r = sig.slice(0, 66)
      const s = '0x' + sig.slice(66, 130)
      let v = '0x' + sig.slice(130, 132)
      v = this.loomWeb3.utils.toDecimal(v)
      await this.tronGateway.withdrawTRX(TRX_AMOUNT, r, s, v).send({ from: this.tronAddrBase58 })

      console.log('waiting for shasta balance to get updated')
      const maxRetries = 10
      let retries = 0
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
      const initialShastaBalance = await this.tronWeb.trx.getBalance(this.tronAddrBase58)
      let currentShastaBalance = initialShastaBalance
      while (initialShastaBalance == currentShastaBalance && retries < maxRetries) {
        currentShastaBalance = await this.tronWeb.trx.getBalance(this.tronAddrBase58)
        await delay(2000)
        retries++
      }
      if (retries == maxRetries) {
        console.log('Waiting is over... No change!')
      } else {
        console.log('Balance updated after ' + retries + ' retries. Refreshing balances')
        await this.refreshBalance()
      }
    },
    async depositWithdrawTRXExample () {
      try {
        await this.init()
        await this.getTronGatewayContract()
        await this.getLoomGatewayContract()
        await this.getLoomTRXContract()
        await this.refreshBalance()
        await this.filterEvents()
      } catch (error) {
        this.info = 'An error occured. Check the browser console for more details.'
      }
    },
    async filterEvents () {
      this.loomTRX.events.Transfer({ filter: { address: this.loomAddressInHex } }, async (err, event) => {
        if (err) console.error('Error on event', err)
        await this.refreshBalance()
      })
    }
  },
  async mounted () {
    await new Promise((resolve) => {
      const tronWebState = {
        installed: !!window.tronWeb,
        loggedIn: window.tronWeb && window.tronWeb.ready && window.tronWeb.fullNode.host != 'http://127.0.0.1'
      }

      if (tronWebState.installed) {
        this.tronLinkStatus = tronWebState
      }

      if (tronWebState.loggedIn) {
        this.tronWeb = window.tronWeb
        this.tronAddrBase58 = window.tronWeb.defaultAddress.base58
        this.tronCurrentNetwork = window.tronWeb.fullNode.host
      } else {
        this.userTronAddr = null
        this.tronCurrentNetwork = null
      }

      return resolve()
    })
    await this.depositWithdrawTRXExample()
  }
})

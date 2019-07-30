import {
  ethers
} from 'ethers'

import Portis from '@portis/web3'
import Web3 from 'web3'
import SimpleStoreJSON from '../truffle/build/contracts/SimpleStore.json'

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

var sample = new Vue({
  el: '#counter',
  data: {
    info: 'Portis demo. Wait a bit until it gets initialized.',
    counter: 0,
    web3js: null,
    publicKey: null,
    chainId: 'extdev-plasma-us1',
    writeUrl: 'wss://extdev-plasma-us1.dappchains.com/websocket',
    readUrl: 'wss://extdev-plasma-us1.dappchains.com/queryws',
    client: null,
    web3Ethereum: null,
    loomProvider: null,
    contract: null,
    networkId: 9545242630824,
    callerChainId: 'eth',
    loomAddress: null
  },
  methods: {
    async init () {
      const privateKey = this.getPrivateKey()
      this.publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
      this.client = new Client(
        this.chainId,
        this.writeUrl,
        this.readUrl
      )
      let provider = this.web3js.currentProvider
      provider.isMetaMask = true
      const ethersProvider = new ethers.providers.Web3Provider(provider)
      const signer = ethersProvider.getSigner()
      this.ethAddress = await signer.getAddress()
      console.log('ethAddress: ' + this.ethAddress)
      const to = new Address('eth', LocalAddress.fromHexString(this.ethAddress))
      const from = new Address(this.client.chainId, LocalAddress.fromPublicKey(this.publicKey))
      console.log('to: ' + to)
      console.log('from: ' + from)
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
    async getContract () {
      const web3 = new Web3(this.loomProvider)
      this.contract = new web3.eth.Contract(SimpleStoreJSON.abi, SimpleStoreJSON.networks[this.networkId].address)
    },
    async testEthSigning () {
      const value = parseInt(this.counter, 10)
      await this.contract.methods
        .set(value)
        .send({
          from: this.ethAddress
        })
    },
    async increment () {
      this.info = 'Please sign the transaction.'
      this.counter += 1
      await this.testEthSigning()
    },

    async decrement () {
      this.info = 'Please sign the transaction.'
      if (this.counter > 0) {
        this.counter -= 1
        await this.testEthSigning()
      } else {
        console.log('counter should be > 1.')
      }
    },
    async filterEvents () {
      this.contract.events.NewValueSet({ filter: { address: this.loomAddress } }, (err, event) => {
        if (err) console.error('Error on event', err)
        else {
          if (event.returnValues._value.toString() === this.counter.toString()) {
            this.info = 'Looking good! Expected: ' + this.counter.toString() + ', Returned: ' + event.returnValues._value.toString()
          } else {
            this.info = 'An error occured! Expected: ' + this.counter.toString() + ', Returned: ' + event.returnValues._value.toString()
          }
        }
      })
    },
    async  ethSigningDemo () {
      if (await this.init()) {
        await this.getContract()
        await this.filterEvents()
        await this.testEthSigning()
      }
    }
  },
  async mounted () {
    const portis = new Portis('2c275e48-a16c-43ff-9ca5-cc8fc045468a', 'rinkeby')
    await portis.showPortis()
    this.web3js = new Web3(portis.provider)
    await this.ethSigningDemo()
  }
})

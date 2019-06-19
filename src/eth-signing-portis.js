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
    info: 'Portis demo',
    counter: 0,
    web3js: null,
    publicKey: null,
    chainId: 'extdev-plasma-us1',
    writeUrl: 'wss://extdev-plasma-us1.dappchains.com/websocket',
    readUrl: 'wss://extdev-plasma-us1.dappchains.com/queryws',
    client: null,
    web3Ethereum: null
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
    },
    async testSig () {
      //let accounts = await this.web3js.eth.getAccounts()
      //console.log('Portis address: ' + accounts[0])
      let from = '0x93a691283F897Dce50e80419ff069d566aEaB0C7'
      let message = this.web3js.utils.toHex("Hello world!");
      let signedMessage = await this.web3js.currentProvider.send("personal_sign", [
        message,
        from
      ])
      console.log(`Portis signed message: ${signedMessage}`)

      //let accounts = await this.web3js.eth.getAccounts()
      from = '0x93a691283F897Dce50e80419ff069d566aEaB0C7'
      console.log('Metamask account: ' + from)
      message = this.web3Ethereum.utils.toHex("Hello world!");
      signedMessage = await this.web3Ethereum.eth.personal.sign(message, from)
      console.log(`Metamask signed message: ${signedMessage}`)
    }
  },
  async mounted () {
    const portis = new Portis('c4c01c30-b889-4d04-a965-ef55adeff66e', 'rinkeby')
    this.web3js = new Web3(portis.provider)
    if (typeof ethereum !== 'undefined') {
      ethereum.enable()
      .catch(console.error)
    }
    this.web3Ethereum = new Web3(window.web3.currentProvider)
    await this.testSig()
    //await this.init()
  }
})

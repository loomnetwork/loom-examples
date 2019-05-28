import {
  ethers
} from 'ethers'
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
  CachedNonceTxMiddleware
} from 'loom-js'
var web3js
var data = {
  chainId: 'extdev-plasma-us1',
  writeUrl: 'wss://extdev-plasma-us1.dappchains.com/websocket',
  readUrl: 'wss://extdev-plasma-us1.dappchains.com/queryws',
  networkId: 9545242630824,
  callerChainId: 'eth',
  ethAddress: null,
  client: null,
  loomProvider: null,
  contract: null,
  publicKey: null
}
const Web3 = require('web3')

function getPrivateKey () {
  let privateKeyString = 'b5s2U8j2nVfWXkYRSi1VnsDDLyv7H9V6tfXkC8tXvf6MqkIsjwLZ35/CYRYIsltZhLohO4tOGuJ0a73V4r9lgg=='
  const privateKey = CryptoUtils.B64ToUint8Array(privateKeyString)
  return privateKey
}

async function init () {
  const privateKey = getPrivateKey()
  data.publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
  data.client = new Client(
    data.chainId,
    data.writeUrl,
    data.readUrl
  )
  const ethersProvider = new ethers.providers.Web3Provider(web3js.currentProvider)
  const signer = ethersProvider.getSigner()
  data.ethAddress = await signer.getAddress()
  const to = new Address('eth', LocalAddress.fromHexString(data.ethAddress))
  const from = new Address(data.client.chainId, LocalAddress.fromPublicKey(data.publicKey))
  const addressMapper = await Contracts.AddressMapper.createAsync(
    data.client,
    new Address(data.client.chainId, LocalAddress.fromPublicKey(data.publicKey))
  )
  if (await addressMapper.hasMappingAsync(to)) {
    console.log('Mapping already exists')
    const mapping = await addressMapper.getMappingAsync(from)
    if (mapping.to.toString() !== to.toString()) {
      console.log('Your Loom Address is mapped to a different Ethereum address. Please switch to ' + data.ethAddress)
      return false
    }
  } else {
    const ethersSigner = new EthersSigner(signer)
    await addressMapper.addIdentityMappingAsync(from, to, ethersSigner)
  }
  data.loomProvider = new LoomProvider(data.client, privateKey)
  data.loomProvider.callerChainId = data.callerChainId
  data.loomProvider.setMiddlewaresForAddress(to.local.toString(), [
    new NonceTxMiddleware(
      new Address(data.callerChainId, LocalAddress.fromHexString(data.ethAddress)),
      data.client
    ),
    new SignedEthTxMiddleware(signer)
  ])
  return true
}

async function getContract () {
  const web3 = new Web3(data.loomProvider)
  data.contract = new web3.eth.Contract(SimpleStoreJSON.abi, SimpleStoreJSON.networks[data.networkId].address)
}

async function testEthSigning () {
  const value = 100
  const tx = await data.contract.methods
    .set(100)
    .send({
      from: data.ethAddress
    })
  const ret = tx.events.NewValueSet.returnValues._value
  if (value.toString() === tx.events.NewValueSet.returnValues._value) {
    console.log('Looking good! Expected: ' + value + ', Returned: ' + ret)
  } else {
    console.log('An error occured! Expected: ' + value + ', Returned: ' + ret)
  }
}
async function ethSigningDemo () {
  if (await init()) {
    await getContract()
    await testEthSigning()
  }
}

window.addEventListener('load', async function () {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof window.web3 !== 'undefined') {
    web3js = new Web3(web3.currentProvider)
    await ethSigningDemo()
  } else {
    // Handle the case where the user doesn't have Metamask installed
    // Probably show them a message prompting them to install Metamask
    console.log('Please install Metamask.')
  }
})

/*var sample = new Vue({
  el: '#increase-counter',
  data: {
    counter: 0,
    web3js: null
  },
  async mounted () {
    console.log('mounted')
    if (typeof window.web3 !== 'undefined') {
      this.currentProviderweb3js = new Web3(window.web3.currentProvider)
      await ethSigningDemo()
    } else {
      // Handle the case where the user doesn't have Metamask installed
      // Probably show them a message prompting them to install Metamask
      console.log('Please install Metamask.')
    }
  }
})*/
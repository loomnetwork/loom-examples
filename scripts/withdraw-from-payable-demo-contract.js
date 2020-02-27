const { Client, NonceTxMiddleware, SignedTxMiddleware, Address, LocalAddress, CryptoUtils, LoomProvider, Contracts } = require('loom-js')

const fs = require('fs')
const Web3 = require('web3')
const path = require('path')
const extdevNetworkId = '9545242630824'
const extdevChainId = 'extdev-plasma-us1'
const PayableDemoJSON = require('../loom/build/contracts/PayableDemo.json')
const payableDemoContractAddress = PayableDemoJSON.networks[extdevNetworkId].address

function loadExtdevAccount () {
  const privateKeyStr = fs.readFileSync(path.join(__dirname, '../loom/loom_private_key'), 'utf-8')
  const privateKey = CryptoUtils.B64ToUint8Array(privateKeyStr)
  const publicKey = CryptoUtils.publicKeyFromPrivateKey(privateKey)
  const client = new Client(
    extdevChainId,
    'wss://extdev-plasma-us1.dappchains.com/websocket',
    'wss://extdev-plasma-us1.dappchains.com/queryws'
  )
  client.txMiddleware = [
    new NonceTxMiddleware(publicKey, client),
    new SignedTxMiddleware(privateKey)
  ]
  client.on('error', msg => {
    console.error('Extdev connection error', msg)
  })

  return {
    account: LocalAddress.fromPublicKey(publicKey).toString(),
    web3js: new Web3(new LoomProvider(client, privateKey)),
    client
  }
}

async function getContracts (web3js, client, account) {
  const payableDemoContract = new web3js.eth.Contract(PayableDemoJSON.abi, payableDemoContractAddress)
  const ethCoin = await Contracts.EthCoin.createAsync(
    client,
    Address.fromString(`${client.chainId}:${account}`)
  )
  return { payableDemoContract, ethCoin }
}

function filterEvents (payableDemoContract, web3js) {
  payableDemoContract.events.WithdrawFunds(async (err, event) => {
    if (err) console.error('Error on event', err)
    const owner = event.returnValues.owner
    const balance = event.returnValues.balance
    console.log(owner + ' has withdrawn ' + web3js.utils.fromWei(balance.toString(), 'ether') + ' ETH.')
  })
}

(async () => {
  const { account, web3js, client } = loadExtdevAccount()
  const { payableDemoContract, ethCoin } = await getContracts(web3js, client, account)
  const payableDemoContractBalance = await ethCoin.getBalanceOfAsync(Address.fromString(`${client.chainId}:${payableDemoContractAddress}`))
  if (payableDemoContractBalance.toString() === '0') {
    console.log('The balance of the contract is 0. Nothing to withdraw.')
    client.disconnect()
    process.exit(0)
  }
  filterEvents(payableDemoContract, web3js)
  try {
    await payableDemoContract.methods.withdrawFunds().send({ from: account })
  } catch (error) {
    console.log(`Something went wrong: ${error.message}`)
  }
  const ownerBalanceInWei = await ethCoin.getBalanceOfAsync(Address.fromString(`${client.chainId}:${account}`))
  console.log(`Owner's balance: ${web3js.utils.fromWei(ownerBalanceInWei.toString(), 'ether')}`)
  client.disconnect()
})()

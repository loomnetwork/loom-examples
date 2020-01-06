import GatewayJSON from '../../contracts/Gateway.json'
import {
  CryptoUtils,
  Address,
  Contracts,
  createEthereumGatewayAsync,
  getMetamaskSigner
} from 'loom-js'
import { EventBus } from '../EventBus/EventBus'
import MainNetCoinJSON from '../../ethereum/build/contracts/MyMainNetCoin.json'
import LoomCoinJSON from '../../loom/build/contracts/MyLoomCoin.json'
import { UniversalSigning } from '../UniversalSigning/UniversalSigning'

const Web3 = require('web3')
const BN = require('bn.js')

export default class ERC20 extends UniversalSigning {
  _gas () {
    return 350000
  }

  _RinkebyGatewayAddress () {
    return this.extdevNetworkConfig['rinkeby2ExtdevGatewayAddress']
  }

  async load (web3Ethereum) {
    const { web3Loom, accountMapping, client } = await super._load(web3Ethereum)
    this.accountMapping = accountMapping
    this.web3Ethereum = web3Ethereum
    this.web3Loom = web3Loom
    await this._getContracts(client, web3Ethereum, web3Loom, accountMapping)
    await this._updateBalances()
  }

  async _getContracts (client, web3Ethereum, web3Loom, accountMapping) {
    this.loomGatewayContract = await Contracts.TransferGateway.createAsync(
      client,
      accountMapping.ethereum
    )
    const mainNetCoinContractAddress = MainNetCoinJSON.networks[this.rinkebyNetworkConfig['networkId']].address
    this.mainNetCoinContract = await new web3Ethereum.eth.Contract(MainNetCoinJSON.abi, mainNetCoinContractAddress)
    const loomCoinContractAddress = LoomCoinJSON.networks[this.extdevNetworkConfig['networkId']].address
    this.loomCoinContract = new web3Loom.eth.Contract(LoomCoinJSON.abi, loomCoinContractAddress)
    const networkId = await web3Ethereum.eth.net.getId()
    let version
    switch (networkId) {
      case 1: // Ethereum Mainnet
        version = 1
        break

      case 4: // Rinkeby
        version = 2
        break
      default:
        throw new Error('Ethereum Gateway is not deployed on network ' + networkId)
    }

    const signer = getMetamaskSigner(web3Ethereum.currentProvider)

    this.ethereumGatewayContract = await createEthereumGatewayAsync(
      version,
      this._RinkebyGatewayAddress(),
      signer
    )
  }

  async _updateBalances () {
    const mainNetBalance = await this._getMainNetBalance()
    const loomBalance = await this._getLoomBalance()
    EventBus.$emit('updateBalances', { mainNetBalance: mainNetBalance, loomBalance: loomBalance })
  }

  async _getLoomBalance () {
    const loomWei = await this.loomCoinContract.methods
      .balanceOf(this.accountMapping.plasma.local.toString())
      .call({
        from: this.accountMapping.ethereum.local.toString()
      })
    const balance = this.web3Loom.utils.fromWei(loomWei.toString(), 'ether')
    const limitDecimals = parseFloat(balance).toFixed(2)
    return limitDecimals
  }

  async _getMainNetBalance () {
    const loomWei = await this.mainNetCoinContract.methods
      .balanceOf(this.accountMapping.ethereum.local.toString())
      .call({
        from: this.accountMapping.ethereum.local.toString()
      })
    const balance = this.web3Ethereum.utils.fromWei(loomWei.toString(), 'ether')
    const limitDecimals = parseFloat(balance).toFixed(2)
    return limitDecimals
  }

  async depositERC20 (amount) {
    const rinkebyGatewayAddress = this.extdevNetworkConfig['rinkeby2ExtdevGatewayAddress']
    const amountInWei = this.web3Ethereum.utils.toWei(amount.toString(), 'ether')
    const mainNetContractAddress = MainNetCoinJSON.networks[this.rinkebyNetworkConfig['networkId']].address
    const ethAddress = this.accountMapping.ethereum.local.toString()
    const gas = 489362
    try {
      await this.mainNetCoinContract
        .methods
        .approve(
          rinkebyGatewayAddress,
          amountInWei
        )
        .send({ from: ethAddress })
    } catch (error) {
      console.log('Failed to approve Ethereum Gateway to take the coins.')
      throw error
    }
    try {
      await this.ethereumGatewayContract.depositERC20Async(
        amountInWei,
        mainNetContractAddress,
        { gasLimit: gas }
      )
    } catch (error) {
      console.log('Failed to transfer coin to the Ethereum Gateway')
      throw error
    }
    console.log('Coins deposited.')
  }

  async withdrawERC20 (amount) {
    console.log('Transferring to Loom Gateway.')
    await this._transferCoinsToLoomGateway(amount)
    console.log('Getting withdrawal receipt')
    const receipt = await this._getWithdrawalReceipt()
    console.log('Withdrawing from MainNet Gateway')
    await this._withdrawCoinsFromMainNetGateway(receipt)
  }

  async _transferCoinsToLoomGateway (amount) {
    const amountInWei = this.web3Ethereum.utils.toWei(amount.toString(), 'ether')
    const dAppChainGatewayAddr = this.web3Loom.utils.toChecksumAddress(this.extdevNetworkConfig['extdev2RinkebyGatewayAddress'])
    const ethAddress = this.accountMapping.ethereum.local.toString()
    console.log('Approving Loom Transfer Gateway to take the coins.')
    await this.loomCoinContract.methods
      .approve(dAppChainGatewayAddr, amountInWei)
      .send({ from: ethAddress })

    const timeout = 60 * 1000
    const ownerMainnetAddr = Address.fromString('eth:' + ethAddress)
    const loomCoinContractAddress = LoomCoinJSON.networks[this.extdevNetworkConfig['networkId']].address
    const tokenAddress = Address.fromString(this.extdevNetworkConfig['chainId'] + ':' + loomCoinContractAddress)
    const mainNetContractAddress = MainNetCoinJSON.networks[this.rinkebyNetworkConfig['networkId']].address
    const gatewayContract = this.loomGatewayContract

    const receiveSignedWithdrawalEvent = new Promise((resolve, reject) => {
      let timer = setTimeout(
        () => reject(new Error('Timeout while waiting for withdrawal to be signed')),
        timeout
      )
      const listener = event => {
        const tokenEthAddress = Address.fromString('eth:' + mainNetContractAddress)
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
      new BN(amountInWei, 10),
      tokenAddress,
      ownerMainnetAddr
    )
    await receiveSignedWithdrawalEvent
  }

  async _getWithdrawalReceipt () {
    const userLocalAddr = Address.fromString(this.accountMapping.plasma.toString())
    const gatewayContract = this.loomGatewayContract
    const receipt = await gatewayContract.withdrawalReceiptAsync(userLocalAddr)
    return receipt
  }

  async _withdrawCoinsFromMainNetGateway (receipt) {
    const gatewayContract = this.ethereumGatewayContract
    const gas = this._gas()
    const tx = await gatewayContract.withdrawAsync(receipt, { gasLimit: gas })
    console.log(`Tokens withdrawn from MainNet Gateway.`)
    console.log(`Rinkeby tx hash: ${tx.hash}`)
  }

  async resumeWithdrawal () {
    const receipt = await this._getWithdrawalReceipt()
    if (receipt !== undefined) {
      await this._withdrawCoinsFromMainNetGateway(receipt)
    }
  }

  async _filterEvents () {
    this.loomCoinContract.events.Transfer({ filter: { address: this.accountMapping.plasma.local.toString() } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      await this._updateBalances()
    })
    this.mainNetCoinContract.events.Transfer({ filter: { address: this.accountMapping.ethereum.local.toString() } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      await this._updateBalances()
    })
  }
}

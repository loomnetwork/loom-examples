import GatewayJSON from '../../truffle/build/contracts/Gateway.json'
import {
  CryptoUtils,
  Address,
  Contracts
} from 'loom-js'
import { EventBus } from '../EventBus/EventBus'
import networkConfigs from '../../network-configs.json'
import { UniversalSigning } from '../UniversalSigning/UniversalSigning'

const BN = require('bn.js')
const EthCoin = Contracts.EthCoin

export default class LoomEthCoin extends UniversalSigning {
  _gas () {
    return 350000
  }

  _RinkebyGatewayAddress () {
    return this.extdevNetworkConfig['rinkeby2ExtdevGatewayAddress']
  }

  async load (web3Ethereum) {
    this.extdevNetworkConfig = networkConfigs.networks['extdev']
    const { web3Loom, accountMapping, client } = await super._load(web3Ethereum)
    this.accountMapping = accountMapping
    this.web3Ethereum = web3Ethereum
    this.web3Loom = web3Loom
    this.client = client
    await this._getContracts(client, accountMapping)
    await this._updateBalances()
  }

  async _getContracts (client, accountMapping) {
    this.mainNetGatewayContract = await new this.web3Ethereum.eth.Contract(
      GatewayJSON.abi,
      this._RinkebyGatewayAddress()
    )
    this.ethCoin = await EthCoin.createAsync(
      client,
      accountMapping.ethereum
    )
    this.loomGatewayContract = await Contracts.TransferGateway.createAsync(
      client,
      accountMapping.ethereum
    )
  }

  async depositEth (amount) {
    const ethereumAddress = this.accountMapping.ethereum.local.toString()
    const gasPrice = this.web3Ethereum.utils.toHex(10e9)
    try {
      await this.web3Ethereum.eth.sendTransaction({
        from: ethereumAddress,
        to: this._RinkebyGatewayAddress(),
        value: amount,
        gasLimit: this._gas(),
        gasPrice: gasPrice
      })
    } catch (error) {
      console.log(error)
    }
  }

  async _approveGatewayToTakeEth (amount) {
    console.log('Approving the gateway to take the eth')
    const totalAmount = amount + this._gas()
    const gatewayAddress = Address.fromString(this.loomGatewayContract.address.toString())
    await this.ethCoin.approveAsync(gatewayAddress, new BN(totalAmount))
  }

  async _transferEthToLoomGateway (amount) {
    console.log('transfer eth to loom gateway')
    const ownerAddr = this.accountMapping.ethereum
    const loomGatewayAddr = Address.fromString(this.loomGatewayContract.address.toString())
    const rinkebyGatewayAddr = Address.fromString(`eth:${this._RinkebyGatewayAddress().toString()}`)
    const timeout = 60 * 1000
    const receiveSignedWithdrawalEvent = new Promise((resolve, reject) => {
      let timer = setTimeout(
        () => reject(new Error('Timeout while waiting for withdrawal to be signed')),
        timeout
      )
      const listener = event => {
        if (
          event.tokenContract.toString() === rinkebyGatewayAddr.toString() &&
          event.tokenOwner.toString() === ownerAddr.toString()
        ) {
          clearTimeout(timer)
          timer = null
          this.loomGatewayContract.removeAllListeners(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL)
          resolve(event)
        }
      }
      this.loomGatewayContract.on(Contracts.TransferGateway.EVENT_TOKEN_WITHDRAWAL, listener)
    })
    const rinkebyGatewayAddress = Address.fromString(`eth:${this._RinkebyGatewayAddress()}`)
    await this.loomGatewayContract.withdrawETHAsync(new BN(amount), rinkebyGatewayAddress, ownerAddr)
    console.log(`${amount.toString()} wei deposited to DAppChain Gateway...`)
    await receiveSignedWithdrawalEvent
  }

  async _getWithdrawalReceipt () {
    const userLocalAddr = this.accountMapping.plasma
    const gatewayContract = this.loomGatewayContract
    const data = await gatewayContract.withdrawalReceiptAsync(userLocalAddr)
    console.log('data:', data)
    if (!data) {
      return null
    }
    const signature = CryptoUtils.bytesToHexAddr(data.oracleSignature)
    return {
      signature: signature,
      amount: data.value.toString(10),
      tokenContract: data.tokenContract.local.toString()
    }
  }

  async _withdrawEthFromMainNetGateway (data) {
    console.log('withdrawing from mainnet gateway')
    const gatewayContract = this.mainNetGatewayContract
    const ethereumAddress = this.accountMapping.ethereum.local.toString()
    const gas = this._gas()
    const gasEstimate = await gatewayContract.methods
      .withdrawETH(data.amount.toString(), data.signature)
      .estimateGas({ from: ethereumAddress, gas })

    if (gasEstimate == gas) {
      throw new Error('Not enough enough gas, send more.')
    }
    const tx = await gatewayContract.methods
      .withdrawETH(data.amount.toString(), data.signature)
      .send({ from: ethereumAddress })
    console.log(tx)
  }

  async withdrawEth (amount) {
    await this._approveGatewayToTakeEth(amount)
    await this._transferEthToLoomGateway(amount)
    const data = await this._getWithdrawalReceipt()
    if (data !== undefined) {
      await this._withdrawEthFromMainNetGateway(data)
    }
  }

  async resumeWithdrawal () {
    const data = await this._getWithdrawalReceipt()
    if (data !== undefined) {
      await this._withdrawEthFromMainNetGateway(data)
    }
  }

  async _updateBalances () {
    const mainNetBalance = await this._getMainNetBalance()
    const loomBalance = await this._getLoomBalance()
    EventBus.$emit('updateEthBalance', { mainNetBalance: mainNetBalance, loomBalance: loomBalance })
  }

  async _getMainNetBalance () {
    const wei = await this.web3Ethereum.eth.getBalance(this.accountMapping.ethereum.local.toString())
    return this.web3Ethereum.utils.fromWei(wei.toString(), 'ether')
  }

  async _getLoomBalance () {
    const loomAddress = Address.fromString(this.accountMapping.plasma.toString())
    const wei = await this.ethCoin.getBalanceOfAsync(loomAddress)
    return this.web3Loom.utils.fromWei(wei.toString(), 'ether')
  }

  async approveFee () {
    const gatewayAddress = Address.fromString(this.loomGatewayContract.address.toString())
    await this.ethCoin.approveAsync(gatewayAddress, new BN(this._gas()))
  }
}

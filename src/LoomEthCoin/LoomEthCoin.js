import GatewayJSON from '../../contracts/Gateway.json'
import {
  Address,
  Contracts,
  createEthereumGatewayAsync,
  getMetamaskSigner
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

    const networkId = await this.web3Ethereum.eth.net.getId()
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

    const signer = getMetamaskSigner(this.web3Ethereum.currentProvider)

    this.ethereumGatewayContract = await createEthereumGatewayAsync(
      version,
      this._RinkebyGatewayAddress(),
      signer
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
    console.log('Approving the gateway to take the ETH.')
    const totalAmount = amount + this._gas()
    const gatewayAddress = Address.fromString(this.loomGatewayContract.address.toString())
    await this.ethCoin.approveAsync(gatewayAddress, new BN(totalAmount))
  }

  async _transferEthToLoomGateway (amount) {
    const ownerAddr = this.accountMapping.ethereum
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
    console.log(`${amount.toString()} wei deposited to the Gateway...`)
    await receiveSignedWithdrawalEvent
  }

  async _getWithdrawalReceipt () {
    const userLocalAddr = this.accountMapping.loom
    const gatewayContract = this.loomGatewayContract
    const receipt = await gatewayContract.withdrawalReceiptAsync(userLocalAddr)
    console.log(receipt)
    return receipt
  }

  async _withdrawEthFromMainNetGateway (receipt) {
    console.log('Withdrawing from the Ethereum gateway.')
    const gatewayContract = this.ethereumGatewayContract
    const gas = this._gas()
    const tx = await gatewayContract.withdrawAsync(receipt, { gasLimit: gas })
    console.log(tx)
  }

  async withdrawEth (amount) {
    await this._approveGatewayToTakeEth(amount)
    await this._transferEthToLoomGateway(amount)
    const receipt = await this._getWithdrawalReceipt()
    if (receipt !== null) {
      await this._withdrawEthFromMainNetGateway(receipt)
    }
  }

  async resumeWithdrawal () {
    const receipt = await this._getWithdrawalReceipt()
    if (receipt !== null) {
      await this._withdrawEthFromMainNetGateway(receipt)
    } else {
      console.log('No pending withdrawals.')
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
    const loomAddress = Address.fromString(this.accountMapping.loom.toString())
    const wei = await this.ethCoin.getBalanceOfAsync(loomAddress)
    return this.web3Loom.utils.fromWei(wei.toString(), 'ether')
  }

  async approveFee () {
    const gatewayAddress = Address.fromString(this.loomGatewayContract.address.toString())
    await this.ethCoin.approveAsync(gatewayAddress, new BN(this._gas()))
  }
}

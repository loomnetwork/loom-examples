import {
  LocalAddress,
  CryptoUtils,
  Address,
  Contracts,
  createEthereumGatewayAsync,
  getMetamaskSigner
} from 'loom-js'
import BN from 'bn.js'
import extdevBEP2Token from '../../loom/build/contracts/SampleBEP2Token.json'
import rinkebyBEP2Token from '../../ethereum/build/contracts/SampleERC20MintableToken.json'
import { BinanceTransferGateway } from 'loom-js/dist/contracts'
import bech32 from 'bech32'
import { EventBus } from '../EventBus/EventBus'
import GatewayJSON from '../../contracts/Gateway.json'
import { UniversalSigning } from '../UniversalSigning/UniversalSigning'

export default class BinanceExtdevRinkeby extends UniversalSigning {

  _gas () {
    return 350000
  }

  _RinkebyGatewayAddress () {
    return this.extdevNetworkConfig['rinkeby2ExtdevGatewayAddress']
  }

  async load (web3Ethereum) {
    const { web3Loom, accountMapping, client } = await super._load(web3Ethereum)
    this._getExtdevUserAddress(accountMapping)
    await this._getContracts(web3Ethereum, web3Loom, client, accountMapping)
    this.accountMapping = accountMapping
    this.client = client
    await this._filterEvents()
    await this._refreshBalance()
  }

  async _getContracts (web3Ethereum, web3Loom, client, accountMapping) {
    this._getExtdevBEP2Contract(web3Loom)
    this._getRinkebyBEP2Contract(web3Ethereum)
    await this._getExtdev2BinanceTransferGatewayContract(client, accountMapping)
    await this._getExtdev2RinkebyGatewayContract(client, accountMapping)
    await this._getEthereumTransferGatewayContract(web3Ethereum)
  }

  _getExtdevUserAddress (accountMapping) {
    this.extdevUserAddress = accountMapping.plasma.local.toString()
    EventBus.$emit('updateExtdevUserAddress', { extdevUserAddress: this.extdevUserAddress })
  }

  async _getEthereumTransferGatewayContract (web3Ethereum) {
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

  _getExtdevBEP2Contract (web3Loom) {
    const networkId = this.extdevNetworkConfig['networkId']
    const extdevBEP2ContractAddress = extdevBEP2Token.networks[networkId].address
    this.extdevBEP2Contract = new web3Loom.eth.Contract(extdevBEP2Token.abi, extdevBEP2ContractAddress)
  }

  _getRinkebyBEP2Contract (web3Ethereum) {
    const networkId = this.rinkebyNetworkConfig['networkId']
    const rinkebyBEP2ContractAddress = rinkebyBEP2Token.networks[networkId].address
    this.rinkebyBEP2Contract = new web3Ethereum.eth.Contract(rinkebyBEP2Token.abi, rinkebyBEP2ContractAddress)
  }

  async _filterEvents () {
    this.extdevBEP2Contract.events.Transfer({ filter: { address: this.extdevUserAddress } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      this._refreshBalance()
    })
    this.rinkebyBEP2Contract.events.Transfer({ filter: { address: this.accountMapping.ethereum.local.toString() } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      await this._refreshBalance()
    })
  }

  async _refreshBalance () {
    let loomBep2Balance = await this.extdevBEP2Contract.methods.balanceOf(this.extdevUserAddress).call({ from: this.accountMapping.ethereum.local.toString() })
    loomBep2Balance = loomBep2Balance / 100000000

    let rinkebyBep2Balance = await this.rinkebyBEP2Contract.methods.balanceOf(this.accountMapping.ethereum.local.toString()).call({ from: this.accountMapping.ethereum.local.toString() })
    rinkebyBep2Balance = rinkebyBep2Balance / 100000000
    EventBus.$emit('updateBEP2Balance', { loomBep2Balance: loomBep2Balance, rinkebyBep2Balance: rinkebyBep2Balance })
  }

  async _getExtdev2BinanceTransferGatewayContract (client, accountMapping) {
    this.extdev2BinanceGatewayContract = await BinanceTransferGateway.createAsync(
      client,
      accountMapping.ethereum
    )
  }

  async _getBinanceTransferGatewayAddress () {
    const contractAddr = await this.client.getContractAddressAsync('binance-gateway')
    return contractAddr.local.toString()
  }

  async _getExtdev2RinkebyGatewayContract (client, accountMapping) {
    this.extdev2RinkebyGatewayContract = await Contracts.TransferGateway.createAsync(
      client,
      accountMapping.ethereum
    )
  }

  async withdrawToBinance (binanceAddress, amountToWithdraw) {
    const multiplier = new BN(100000000, 10)
    const amountInt = (new BN(parseInt(amountToWithdraw), 10)).mul(multiplier)
    EventBus.$emit('updateStatus', { currentStatus: 'Approving the gateway to take the tokens.' })
    const binanceTransferGatewayAddress = await this._getBinanceTransferGatewayAddress()
    await this.extdevBEP2Contract.methods.approve(binanceTransferGatewayAddress, amountInt.toString()).send({ from: this.accountMapping.ethereum.local.toString() })
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
    let approvedBalance = 0
    EventBus.$emit('updateStatus', { currentStatus: 'Approved. Next -> Checking the allowance.' })
    while (approvedBalance == 0) {
      approvedBalance = await this.extdevBEP2Contract.methods.allowance(this.extdevUserAddress, binanceTransferGatewayAddress).call({ from: this.accountMapping.ethereum.local.toString() })
      await delay(5000)
    }
    EventBus.$emit('updateStatus', { currentStatus: 'Allowance checked. Next -> Withdrawing tokens to Binance' })
    const bep2TokenAddress = Address.fromString('extdev-plasma-us1:' + this.extdevBEP2Contract._address.toLowerCase())
    const tmp = this._decodeAddress(binanceAddress)
    const recipient = new Address('binance', new LocalAddress(tmp))
    await this.extdev2BinanceGatewayContract.withdrawTokenAsync(amountInt, bep2TokenAddress, recipient)
    EventBus.$emit('updateStatus', { currentStatus: 'Succesfully withdrawn!' })
    await delay(1000)
  }

  async withdrawToEthereum (amount) {
    EventBus.$emit('updateStatus', { currentStatus: 'Transferring to Extdev Gateway.' })
    await this._transferCoinsToExtdevGateway(amount)
    EventBus.$emit('updateStatus', { currentStatus: 'Getting withdrawal receipt.' })
    const receipt = await this._getWithdrawalReceipt()
    EventBus.$emit('updateStatus', { currentStatus: 'Withdrawing from Rinkeby Gateway.' })
    await this._withdrawCoinsFromRinkebyGateway(receipt)
  }

  async _transferCoinsToExtdevGateway (amount) {
    const multiplier = new BN(100000000, 10)
    const amountInt = (new BN(parseInt(amount), 10)).mul(multiplier)
    const dAppChainGatewayAddr = this.extdevNetworkConfig['extdev2RinkebyGatewayAddress']
    const ethAddress = this.accountMapping.ethereum.local.toString()
    await this.extdevBEP2Contract.methods
      .approve(dAppChainGatewayAddr, amountInt.toString())
      .send({ from: ethAddress })
    const timeout = 60 * 1000
    const ownerMainnetAddr = Address.fromString('eth:' + ethAddress)
    const loomCoinContractAddress = extdevBEP2Token.networks[this.extdevNetworkConfig['networkId']].address
    const tokenAddress = Address.fromString(this.extdevNetworkConfig['chainId'] + ':' + loomCoinContractAddress)
    const mainNetContractAddress = rinkebyBEP2Token.networks[this.rinkebyNetworkConfig['networkId']].address
    const gatewayContract = this.extdev2RinkebyGatewayContract

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
      amountInt,
      tokenAddress,
      ownerMainnetAddr
    )
    await receiveSignedWithdrawalEvent
  }

  async _getWithdrawalReceipt () {
    const userLocalAddr = Address.fromString(this.accountMapping.plasma.toString())
    const gatewayContract = this.extdev2RinkebyGatewayContract
    const receipt = await gatewayContract.withdrawalReceiptAsync(userLocalAddr)
    return receipt
  }

  async _withdrawCoinsFromRinkebyGateway (receipt) {
    const gatewayContract = this.ethereumGatewayContract
    const gas = this._gas()
    const tx = await gatewayContract.withdrawAsync(receipt, { gasLimit: gas })
    console.log(`Tokens withdrawn from MainNet Gateway.`)
    console.log(`Rinkeby tx hash: ${tx.hash}`)
  }

  async resumeWithdrawal () {
    const receipt = await this._getWithdrawalReceipt()
    if (receipt !== undefined) {
      await this._withdrawCoinsFromRinkebyGateway(receipt)
    }
  }

  async depositToLoom (amount) {
    const multiplier = new BN(100000000, 10)
    const amountInt = (new BN(parseInt(amount), 10)).mul(multiplier)
    const rinkebyGatewayAddress = this.extdevNetworkConfig['rinkeby2ExtdevGatewayAddress']
    const rinkebyContractAddress = rinkebyBEP2Token.networks[this.rinkebyNetworkConfig['networkId']].address
    const userRinkebyAddress = this.accountMapping.ethereum.local.toString()
    const gas = 489362
    EventBus.$emit('updateStatus', { currentStatus: 'Approving the transfer gateway to take the tokens.' })
    try {
      await this.rinkebyBEP2Contract
        .methods
        .approve(
          rinkebyGatewayAddress,
          amountInt.toString()
        )
        .send({ from: userRinkebyAddress })
    } catch (error) {
      console.log('Failed to approve Ethereum Gateway to take the coins.')
      throw error
    }
    EventBus.$emit('updateStatus', { currentStatus: 'Depositing to the transfer gateway.' })
    console.log('Calling depositERC20Async.')
    try {
      await this.ethereumGatewayContract
        .depositERC20Async(
          amountInt.toString(),
          rinkebyContractAddress,
          { gasLimit: gas }
        )
    } catch (error) {
      console.log('Failed to transfer coin to the Ethereum Gateway')
      throw error
    }
    EventBus.$emit('updateStatus', { currentStatus: 'Tokens deposited!' })
  }

  _decodeAddress (value) {
    const decodeAddress = bech32.decode(value)
    return Buffer.from(bech32.fromWords(decodeAddress.words))
  }
}

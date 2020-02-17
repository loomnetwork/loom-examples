import {
  CryptoUtils,
  Address,
  Contracts,
  createEthereumGatewayAsync,
  getMetamaskSigner
} from 'loom-js'
import { EventBus } from '../EventBus/EventBus'
import MainNetTokenJSON from '../../ethereum/build/contracts/MyMainNetToken.json'
import LoomTokenJSON from '../../loom/build/contracts/MyLoomToken.json'
import { UniversalSigning } from '../UniversalSigning/UniversalSigning'

const BN = require('bn.js')

export default class ERC721 extends UniversalSigning {
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
    const mainNetTokenContractAddress = MainNetTokenJSON.networks[this.rinkebyNetworkConfig['networkId']].address
    this.mainNetTokenContract = await new web3Ethereum.eth.Contract(MainNetTokenJSON.abi, mainNetTokenContractAddress)
    const loomTokenContractAddress = LoomTokenJSON.networks[this.extdevNetworkConfig['networkId']].address
    this.loomTokenContract = new web3Loom.eth.Contract(LoomTokenJSON.abi, loomTokenContractAddress)
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
    const balance = await this.loomTokenContract.methods.balanceOf(this.accountMapping.loom.local.toString()).call({
      from: this.accountMapping.ethereum.local.toString()
    })
    return balance
  }

  async _getMainNetBalance () {
    const balance = await this.mainNetTokenContract.methods.balanceOf(this.accountMapping.ethereum.local.toString()).call({
      from: this.accountMapping.ethereum.local.toString()
    })
    return balance
  }

  async _filterEvents () {
    this.loomTokenContract.events.Transfer({ filter: { address: this.accountMapping.loom.local.toString() } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      await this._updateBalances()
    })

    this.mainNetTokenContract.events.Transfer({ filter: { address: this.accountMapping.ethereum.local.toString() } }, async (err, event) => {
      if (err) console.error('Error on event', err)
      await this._updateBalances()
    })
  }

  async depositERC721 (tokenId) {
    const rinkebyGatewayAddress = this.extdevNetworkConfig['rinkeby2ExtdevGatewayAddress']
    const ethAddress = this.accountMapping.ethereum.local.toString()
    const gasEstimate = await this.mainNetTokenContract.methods.depositToGateway(rinkebyGatewayAddress, tokenId).estimateGas({ from: ethAddress })
    if (gasEstimate === this._gas()) {
      throw new Error('Not enough enough gas, send more.')
    }
    EventBus.$emit('updateBalances', { mainNetBalance: 0, loomBalance: 0 })
    return this.mainNetTokenContract.methods.depositToGateway(rinkebyGatewayAddress, tokenId).send({ from: ethAddress, gas: gasEstimate })
  }

  async withdrawERC721 (tokenId) {
    console.log('Transferring to Loom Gateway.')
    await this._transferTokensToLoomGateway(tokenId)
    console.log('Getting withdrawal receipt')
    const receipt = await this._getWithdrawalReceipt()
    console.log('Withdrawing from MainNet Gateway')
    await this._withdrawTokensFromMainNetGateway(receipt)
  }

  async _transferTokensToLoomGateway (tokenId) {
    const gatewayAddr = this.web3Loom.utils.toChecksumAddress(this.extdevNetworkConfig['extdev2RinkebyGatewayAddress'])
    const ethAddress = this.accountMapping.ethereum.local.toString()
    console.log('Approving Loom Transfer Gateway to take the token.')
    await this.loomTokenContract.methods
      .approve(gatewayAddr, tokenId)
      .send({ from: ethAddress })
    const timeout = 60 * 1000
    const ownerMainnetAddr = Address.fromString('eth:' + ethAddress)
    const loomTokenContractAddress = LoomTokenJSON.networks[this.extdevNetworkConfig['networkId']].address
    const tokenAddress = Address.fromString(this.extdevNetworkConfig['chainId'] + ':' + loomTokenContractAddress)
    const mainNetContractAddress = MainNetTokenJSON.networks[this.rinkebyNetworkConfig['networkId']].address
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
    await gatewayContract.withdrawERC721Async(
      new BN(tokenId),
      tokenAddress,
      ownerMainnetAddr
    )
    await receiveSignedWithdrawalEvent
  }

  async _getWithdrawalReceipt () {
    const userLocalAddr = Address.fromString(this.accountMapping.loom.toString())
    const gatewayContract = this.loomGatewayContract
    const receipt = await gatewayContract.withdrawalReceiptAsync(userLocalAddr)
    return receipt
  }

  async _withdrawTokensFromMainNetGateway (receipt) {
    const gatewayContract = this.ethereumGatewayContract
    const gas = this._gas()
    const tx = await gatewayContract.withdrawAsync(receipt, { gasLimit: gas })
    console.log(`Tokens withdrawn from MainNet Gateway.`)
    console.log(`Rinkeby tx hash: ${tx.hash}`)
    EventBus.$emit('updateBalances', { mainNetBalance: 0, loomBalance: 0 })
  }

  async resumeWithdrawal () {
    const receipt = await this._getWithdrawalReceipt()
    if (receipt !== null) {
      await this._withdrawTokensFromMainNetGateway(receipt)
    } else {
      console.log('No withdrawal receipt exists.')
    }
  }
}

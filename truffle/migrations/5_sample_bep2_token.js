const SampleBEP2Token = artifacts.require('./SampleBEP2Token.sol')

const gatewayAddress = '0x166e1C5Bf627DFCbDDbcF1cc3b848813a9FC1446'.toLowerCase()
const name = "My Sample BEP2 Token"
const symbol = "SBT"

module.exports = function (deployer, network, accounts) {
  if (network !== 'asia1') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(SampleBEP2Token, gatewayAddress, name, symbol)
    const sampleBEP2TokenInstance = await SampleBEP2Token.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`SampleBEP2Token Contract Address: ${sampleBEP2TokenInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
}

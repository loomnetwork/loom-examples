const SampleBEP2Token = artifacts.require('./SampleBEP2Token.sol')

const gatewayAddress = '0xf801deec09eddf70b81e054c2241ece5f49edac2'.toLowerCase()
const name = "My Sample BEP2 Token"
const symbol = "SBT"

module.exports = function (deployer, network, accounts) {
  if (network !== 'extdev') {
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

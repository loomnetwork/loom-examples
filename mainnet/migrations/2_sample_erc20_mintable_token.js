const SampleERC20MintableToken = artifacts.require('./SampleERC20MintableToken.sol')

const gatewayAddress = '0x9c67fD4eAF0497f9820A3FBf782f81D6b6dC4Baa'.toLowerCase()

module.exports = function (deployer, network, accounts) {
  if (network !== 'rinkeby') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(SampleERC20MintableToken, gatewayAddress)
    const SampleERC20MintableTokenInstance = await SampleERC20MintableToken.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`SampleERC20MintableToken Contract Address: ${SampleERC20MintableTokenInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
}

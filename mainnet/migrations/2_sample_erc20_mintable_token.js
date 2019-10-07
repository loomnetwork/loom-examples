const SampleERC20MintableToken = artifacts.require('./SampleERC20MintableToken.sol')

const gatewayAddress = '0xb73C9506cb7f4139A4D6Ac81DF1e5b6756Fab7A2'.toLowerCase()

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

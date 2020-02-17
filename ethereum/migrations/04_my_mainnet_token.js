const MyMainNetToken = artifacts.require('./MyMainNetToken.sol')

module.exports = function (deployer, network, accounts) {
  if (network !== 'rinkeby') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(MyMainNetToken)
    const MyMainNetTokenInstance = await MyMainNetToken.deployed()
    await MyMainNetTokenInstance.mint('1')

    console.log('\n*************************************************************************\n')
    console.log(`MyMainNetToken Contract Address: ${MyMainNetTokenInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
}
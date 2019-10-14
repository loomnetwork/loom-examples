const MyMainNetCoin = artifacts.require('./MyMainNetCoin.sol')

module.exports = function (deployer, network, accounts) {
  if (network !== 'rinkeby') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(MyMainNetCoin)
    const MyMainNetCoinInstance = await MyMainNetCoin.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`MyMainNetCoin Contract Address: ${MyMainNetCoinInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
}
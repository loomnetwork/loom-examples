const MyLoomCoin = artifacts.require('./MyLoomCoin.sol')

let gatewayAddress = '0xE754d9518bF4a9C63476891eF9Aa7D91c8236a5d'.toLowerCase()

module.exports = function (deployer, network, accounts) {
  if (network !== 'extdev') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(MyLoomCoin, gatewayAddress)
    const myLoomCoinInstance = await MyLoomCoin.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`MyLoomCoin Contract Address: ${myLoomCoinInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
}

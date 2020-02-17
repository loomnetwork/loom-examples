const MyLoomToken = artifacts.require('./MyLoomToken.sol')

const gatewayAddress = '0xE754d9518bF4a9C63476891eF9Aa7D91c8236a5d'.toLowerCase()

module.exports = function (deployer, network, accounts) {
  if (network !== 'extdev') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(MyLoomToken, gatewayAddress)
    const myLoomTokenInstance = await MyLoomToken.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`MyLoomToken Contract Address: ${myLoomTokenInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
}

const PayableDemo = artifacts.require('./PayableDemo.sol')

module.exports = function (deployer, network, accounts) {
  if (network !== 'extdev') {
    return
  }

  deployer.then(async () => {
    await deployer.deploy(PayableDemo)
    const PayableDemoInstance = await PayableDemo.deployed()

    console.log('\n*************************************************************************\n')
    console.log(`PayableDemo Contract Address: ${PayableDemoInstance.address}`)
    console.log('\n*************************************************************************\n')
  })
}

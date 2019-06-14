var SimpleStore = artifacts.require("./SimpleStore.sol");
module.exports = function (deployer, network, accounts) {
  if (network !== 'extdev') {
    return
  }
  deployer.deploy(SimpleStore);
};

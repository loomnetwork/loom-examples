pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";

/**
 * @title ERC20 example for token contracts to be deployed to Ethereum.
 */
contract MyMainNetCoin is ERC20Mintable {
  string public name = "MyMainNetCoin";
  string public symbol = "MMC";
  uint8 public decimals = 18;

  // one billion in initial supply
  uint256 public constant INITIAL_SUPPLY = 1000000000;

  constructor() public {
    _mint(msg.sender, INITIAL_SUPPLY * (10 ** uint256(decimals)));
  }
}
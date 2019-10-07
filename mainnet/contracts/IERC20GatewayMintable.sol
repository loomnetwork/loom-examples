pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC20 interface for token contracts deployed to mainnet that let Ethereum Gateway mint the token.
 */
contract IERC20GatewayMintable is ERC20 {
    // Called by the Ethereum Gateway contract to mint tokens.
    //
    // NOTE: the Ethereum gateway will call this method unconditionally.
    function mintTo(address _to, uint256 _amount) public;
}


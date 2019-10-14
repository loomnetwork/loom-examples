pragma solidity 0.5.0;

import './BEP2TokenTemplate.sol';

contract SampleBEP2Token is BEP2TokenTemplate {
    constructor (address _gateway, string memory _name, string memory _symbol) BEP2TokenTemplate(_gateway, _name, _symbol) public {
    }

}


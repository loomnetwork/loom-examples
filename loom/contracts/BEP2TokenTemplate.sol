pragma solidity 0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol';

contract BEP2TokenTemplate is ERC20Mintable {
    mapping (address => bool) gateway;
    string public name;
    string public symbol;
    uint8 public constant decimals = 8; // Need to have exact 8 decimals because of BEP2 specifications
    mapping (address => bool) validator;

    constructor (address _gateway, string memory _name, string memory _symbol) public {
        gateway[_gateway] = true;
        validator[msg.sender] = true;
        name = _name;
        symbol = _symbol;
    }

    function mintToGateway(uint256 _amount) onlyGateway public {
        _mint(msg.sender, _amount);
    }

    // Overloaded `mint` function of Mintable token for onlyValidator
    function mint (address _to, uint256 _amount) onlyValidator public returns (bool) {
        mint(_to, _amount);
        return true;
    }

    function addValidator(address newValidator) onlyValidator public {
        validator[newValidator] = true;
    }

    modifier onlyValidator() {
        require(validator[msg.sender] == true, "not authorized to perform this action");
        _;
    }

    modifier onlyGateway(){
        require(gateway[msg.sender] == true, "only gateways are allowed mint");
        _;
    }

    function addGateway(address _gateway) onlyValidator public {
        gateway[_gateway] = true;
    }

    function removeGateway(address _gateway) onlyValidator public {
        gateway[_gateway] = false;
    }

}

pragma solidity ^0.5.2;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
import "./IERC20GatewayMintable.sol";

/**
 * @title ERC20 example for token contracts to be deployed to Ethereum.
 */
contract SampleERC20MintableToken is ERC20Mintable, IERC20GatewayMintable {

    mapping (address => bool) gateways;
    string public name;
    string public symbol;
    uint8 public constant decimals = 8;
    mapping (address => bool) validators;

    event ValidatorAdded(address validator);
    event ValidatorRemoved(address validator);

    event GatewayAdded(address gateway);
    event GatewayRemoved(address gateway);

    constructor(address _gateway) public {
        gateways[_gateway] = true;
        validators[msg.sender] = true;
        name = "erc20mintable";
        symbol = "MNT20";
    }

    function mintTo(address _to, uint256 _amount) onlyGateway public {
        _mint(_to, _amount);
    }

    /**
     * @dev Override function to mint tokens
     * @param _to The address that will receive the minted tokens.
     * @param _amount The token amount to mint.
     * @return A boolean that indicates if the operation was successful.
     */
    function mint(address _to, uint256 _amount) onlyValidator public returns (bool) {
        _mint(_to, _amount);
        return true;
    }

    function addValidator(address newValidator) onlyValidator public {
        validators[newValidator] = true;
        emit ValidatorAdded(newValidator);
    }

    function removeValidator(address validator) onlyValidator public {
        validators[validator] = false;
        emit ValidatorRemoved(validator);
    }

    modifier onlyValidator() {
        require(validators[msg.sender] == true, "only validators authorized to perform this action");
        _;
    }

    modifier onlyGateway(){
        require(gateways[msg.sender] == true, "only gateways are allowed mint");
        _;
    }

    function addGateway(address _gateway) onlyValidator public {
        gateways[_gateway] = true;
        emit GatewayAdded(_gateway);
    }

    function removeGateway(address _gateway) onlyValidator public {
        gateways[_gateway] = false;
        emit GatewayRemoved(_gateway);
    }

    function isValidator(address validator) view public returns (bool) {
        return validators[validator];
    }

    function isGateway(address gateway) view public returns (bool) {
        return gateways[gateway];
    }
}

pragma solidity 0.5.0;

contract SimpleStore {
  uint value;

  event NewValueSet(uint _value);

  function set(uint _value) public {
    require(_value >= 0, "Value must be >= 0!");
    value = _value;
    emit NewValueSet(value);
  }

  function get() public view returns (uint) {
    return value;
  }
}

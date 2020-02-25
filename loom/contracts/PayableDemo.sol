pragma solidity 0.5.0;
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract PayableDemo is Ownable {
  event BuySomething(address buyer);
  event WithdrawFunds(address owner, uint amount);

  function buySomething() external payable {
    require(msg.value == 0.001 ether, "You must send at least 0.001 ETH");
    // Implement your logic here
    emit BuySomething(msg.sender);
  }
  function withdrawFunds() public onlyOwner {
   uint balance = address(this).balance;
   require(balance > 0, "Balance should be > 0.");
   address payable ownerPayable = address(uint160(owner()));
   ownerPayable.transfer(balance);
   emit WithdrawFunds(msg.sender, balance);
  }
}

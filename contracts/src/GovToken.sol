// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";

/// Token test: ai cũng mint được, mỗi ví tối đa MAX_PER_WALLET. Có thể mint sẵn một kho bạc cho DAO lúc deploy.
contract GovToken is ERC20, ERC20Permit, ERC20Votes {
    uint256 public constant MAX_PER_WALLET = 1000 ether;
    mapping(address => uint256) public minted;

    error MintLimitExceeded();

    constructor(string memory name_, string memory symbol_, address treasury, uint256 treasuryAmount)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        if (treasuryAmount > 0) _mint(treasury, treasuryAmount);
    }

    function mint(uint256 amount) external {
        if (minted[msg.sender] + amount > MAX_PER_WALLET) revert MintLimitExceeded();
        minted[msg.sender] += amount;
        _mint(msg.sender, amount);
    }

    // Thời gian theo timestamp để thời gian bỏ phiếu giống nhau trên mọi chain.
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}

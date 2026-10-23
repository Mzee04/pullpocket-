// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PullPocket — prepaid native USDC tab on Arc
/// @notice Opener locks native USDC (18 decimals) for one named puller.
///         Puller withdraws up to the remaining balance. Opener can close
///         anytime and reclaim what is left. One tab per contract instance.
/// @dev On Arc, native USDC uses 18 decimals (`msg.value` / `address.balance`).
///      Do not mix with the 6-decimal ERC-20 view at 0x3600…0000.
contract PullPocket {
    address public opener;
    address public puller;
    uint256 public remaining;
    bool public isOpen;

    event Opened(address indexed opener, address indexed puller, uint256 amount);
    event Pulled(address indexed puller, uint256 amount, uint256 remaining);
    event Closed(address indexed opener, uint256 refunded);

    error AlreadyOpen();
    error NotOpen();
    error NotOpener();
    error NotPuller();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientRemaining();
    error TransferFailed();

    /// @notice Lock native USDC for `puller_`. Callable only when no tab is open.
    /// @param puller_ Wallet allowed to pull against this pocket.
    function open(address puller_) external payable {
        if (isOpen) revert AlreadyOpen();
        if (puller_ == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert ZeroAmount();

        opener = msg.sender;
        puller = puller_;
        remaining = msg.value;
        isOpen = true;

        emit Opened(msg.sender, puller_, msg.value);
    }

    /// @notice Puller withdraws up to `amount` of remaining native USDC.
    function pull(uint256 amount) external {
        if (!isOpen) revert NotOpen();
        if (msg.sender != puller) revert NotPuller();
        if (amount == 0) revert ZeroAmount();
        if (amount > remaining) revert InsufficientRemaining();

        remaining -= amount;

        if (remaining == 0) {
            isOpen = false;
        }

        _send(msg.sender, amount);
        emit Pulled(msg.sender, amount, remaining);
    }

    /// @notice Opener reclaim residual native USDC and close the tab.
    function close() external {
        if (!isOpen) revert NotOpen();
        if (msg.sender != opener) revert NotOpener();

        uint256 refund = remaining;
        remaining = 0;
        isOpen = false;

        if (refund > 0) {
            _send(msg.sender, refund);
        }

        emit Closed(msg.sender, refund);
    }

    /// @dev Arc reverts native sends to address(0); still guard explicitly.
    function _send(address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    receive() external payable {
        revert("PullPocket: direct deposit disabled; use open()");
    }

    fallback() external payable {
        revert("PullPocket: direct deposit disabled; use open()");
    }
}

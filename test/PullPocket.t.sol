// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PullPocket} from "../src/PullPocket.sol";

contract PullPocketTest is Test {
    PullPocket internal pocket;
    address internal opener = makeAddr("opener");
    address internal puller = makeAddr("puller");
    address internal stranger = makeAddr("stranger");

    /// @dev Arc native USDC is 18 decimals. 1 USDC = 1e18.
    uint256 internal constant ONE_USDC = 1e18;

    function setUp() public {
        pocket = new PullPocket();
        vm.deal(opener, 100 * ONE_USDC);
        vm.deal(puller, 1 * ONE_USDC);
        vm.deal(stranger, 1 * ONE_USDC);
    }

    function test_OpenLocksNativeUsdc() public {
        vm.prank(opener);
        pocket.open{value: 10 * ONE_USDC}(puller);

        assertTrue(pocket.isOpen());
        assertEq(pocket.opener(), opener);
        assertEq(pocket.puller(), puller);
        assertEq(pocket.remaining(), 10 * ONE_USDC);
        assertEq(address(pocket).balance, 10 * ONE_USDC);
    }

    function test_PullReducesRemaining() public {
        vm.prank(opener);
        pocket.open{value: 10 * ONE_USDC}(puller);

        uint256 beforeBal = puller.balance;
        vm.prank(puller);
        pocket.pull(3 * ONE_USDC);

        assertEq(pocket.remaining(), 7 * ONE_USDC);
        assertEq(puller.balance, beforeBal + 3 * ONE_USDC);
        assertTrue(pocket.isOpen());
    }

    function test_PullExactRemainingCloses() public {
        vm.prank(opener);
        pocket.open{value: 5 * ONE_USDC}(puller);

        vm.prank(puller);
        pocket.pull(5 * ONE_USDC);

        assertEq(pocket.remaining(), 0);
        assertFalse(pocket.isOpen());
        assertEq(address(pocket).balance, 0);
    }

    function test_CloseRefundsOpener() public {
        vm.prank(opener);
        pocket.open{value: 8 * ONE_USDC}(puller);

        vm.prank(puller);
        pocket.pull(2 * ONE_USDC);

        uint256 before = opener.balance;
        vm.prank(opener);
        pocket.close();

        assertFalse(pocket.isOpen());
        assertEq(pocket.remaining(), 0);
        assertEq(opener.balance, before + 6 * ONE_USDC);
        assertEq(address(pocket).balance, 0);
    }

    function test_RevertOpenZeroPuller() public {
        vm.prank(opener);
        vm.expectRevert(PullPocket.ZeroAddress.selector);
        pocket.open{value: ONE_USDC}(address(0));
    }

    function test_RevertOpenZeroAmount() public {
        vm.prank(opener);
        vm.expectRevert(PullPocket.ZeroAmount.selector);
        pocket.open{value: 0}(puller);
    }

    function test_RevertOpenTwice() public {
        vm.prank(opener);
        pocket.open{value: ONE_USDC}(puller);

        vm.prank(opener);
        vm.expectRevert(PullPocket.AlreadyOpen.selector);
        pocket.open{value: ONE_USDC}(puller);
    }

    function test_RevertPullNotPuller() public {
        vm.prank(opener);
        pocket.open{value: ONE_USDC}(puller);

        vm.prank(stranger);
        vm.expectRevert(PullPocket.NotPuller.selector);
        pocket.pull(1);
    }

    function test_RevertPullOverRemaining() public {
        vm.prank(opener);
        pocket.open{value: ONE_USDC}(puller);

        vm.prank(puller);
        vm.expectRevert(PullPocket.InsufficientRemaining.selector);
        pocket.pull(ONE_USDC + 1);
    }

    function test_RevertCloseNotOpener() public {
        vm.prank(opener);
        pocket.open{value: ONE_USDC}(puller);

        vm.prank(stranger);
        vm.expectRevert(PullPocket.NotOpener.selector);
        pocket.close();
    }

    function test_RevertDirectDeposit() public {
        uint256 before = address(pocket).balance;
        vm.prank(opener);
        (bool ok,) = address(pocket).call{value: ONE_USDC}("");
        assertFalse(ok);
        assertEq(address(pocket).balance, before);
    }

    function test_ReopenAfterClose() public {
        vm.prank(opener);
        pocket.open{value: 2 * ONE_USDC}(puller);

        vm.prank(opener);
        pocket.close();

        address puller2 = makeAddr("puller2");
        vm.prank(opener);
        pocket.open{value: 4 * ONE_USDC}(puller2);

        assertTrue(pocket.isOpen());
        assertEq(pocket.puller(), puller2);
        assertEq(pocket.remaining(), 4 * ONE_USDC);
    }

    function testFuzz_PullWithinRemaining(uint256 deposit, uint256 pullAmt) public {
        deposit = bound(deposit, 1, 50 * ONE_USDC);
        pullAmt = bound(pullAmt, 1, deposit);

        vm.deal(opener, deposit);
        vm.prank(opener);
        pocket.open{value: deposit}(puller);

        vm.prank(puller);
        pocket.pull(pullAmt);

        assertEq(pocket.remaining(), deposit - pullAmt);
        if (pullAmt == deposit) {
            assertFalse(pocket.isOpen());
        } else {
            assertTrue(pocket.isOpen());
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PullPocket} from "../src/PullPocket.sol";

/// @notice Deploy PullPocket to Arc testnet or mainnet.
/// @dev Studio deploys testnet for you. For mainnet, the user runs this with a
///      funded key — never paste private keys into chat.
///
/// Testnet example:
///   forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.testnet.arc.io \
///     --broadcast --legacy
///
/// Mainnet example (user step):
///   forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.mainnet.arc.io \
///     --broadcast --legacy
///
/// Arc mempool floor: maxFeePerGas >= 20 gwei. Gas token is native USDC (18 decimals).
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        PullPocket pocket = new PullPocket();
        console2.log("PullPocket deployed at:", address(pocket));
        vm.stopBroadcast();
    }
}

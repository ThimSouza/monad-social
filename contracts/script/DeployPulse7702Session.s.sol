// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Pulse7702Session} from "../src/Pulse7702Session.sol";

/// @notice Deploys the EIP-7702 implementation contract used by the Vite frontend (`VITE_PULSE7702_IMPLEMENTATION`).
///
/// Testnet (broadcast + optional verify):
/// ```bash
/// source .env
/// forge script script/DeployPulse7702Session.s.sol:DeployPulse7702Session \
///   --rpc-url https://testnet-rpc.monad.xyz \
///   --broadcast \
///   -vvvv
/// ```
///
/// With Sourcify verification in the same command:
/// ```bash
/// forge script script/DeployPulse7702Session.s.sol:DeployPulse7702Session \
///   --rpc-url https://testnet-rpc.monad.xyz \
///   --broadcast \
///   --verify \
///   --verifier sourcify \
///   --verifier-url 'https://sourcify-api-monad.blockvision.org/' \
///   -vvvv
/// ```
///
/// Standalone verify (after deploy):
/// ```bash
/// ./script/verify_pulse7702_session.sh
/// ```
contract DeployPulse7702Session is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("===== Pulse7702Session deploy =====");
        console.log("Deployer :", deployer);
        console.log("Chain ID :", block.chainid);
        console.log("");

        vm.startBroadcast(deployerKey);

        Pulse7702Session session = new Pulse7702Session();
        console.log("Pulse7702Session :", address(session));

        vm.stopBroadcast();

        console.log("");
        console.log("===== frontend/.env =====");
        console.log("VITE_PULSE7702_IMPLEMENTATION=%s", address(session));
        console.log("");
        console.log("===== contracts/.env (optional) =====");
        console.log("PULSE7702_SESSION_ADDRESS=%s", address(session));
    }
}

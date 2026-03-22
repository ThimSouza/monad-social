// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Pulse7702Session} from "../src/Pulse7702Session.sol";

contract Pulse7702SessionTest is Test {
    Pulse7702Session internal session;

    function setUp() public {
        session = new Pulse7702Session();
    }

    function test_deploy_setsZeroSessionAndNonce() public view {
        assertEq(session.sessionSigner(), address(0));
        assertEq(session.relayNonce(), 0);
    }
}

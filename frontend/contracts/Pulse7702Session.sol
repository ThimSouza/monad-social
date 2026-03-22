// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Pulse7702Session — EIP-7702 implementation for session-key relayed calls
/// @notice Deploy this contract and point users' EOAs here via EIP-7702 (type-4 tx).
///         On Monad, keep ≥10 MON if the EOA stays 7702-delegated (reserve balance rules).
contract Pulse7702Session {
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }

    uint256 public relayNonce;
    address public sessionSigner;

    event SessionSignerSet(address indexed signer);
    event Executed(uint256 indexed kind, uint256 calls);
    event Relayed(address indexed relayer, uint256 relayNonceAfter);

    /// @dev Only valid when `msg.sender == address(this)` (7702-delegated EOA calling itself).
    function setSessionSigner(address signer) external {
        require(msg.sender == address(this), "only self");
        sessionSigner = signer;
        emit SessionSignerSet(signer);
    }

    /// @dev Direct path: one wallet confirmation can batch many calls through the delegated EOA.
    function execute(Call[] calldata calls) external payable {
        require(msg.sender == address(this), "only self");
        _executeCalls(calls);
        emit Executed(0, calls.length);
    }

    /// @dev Relay path: relayer pays gas; `sessionSigner` must have signed the payload (no wallet pop-up).
    function executeRelayed(Call[] calldata calls, bytes calldata sig) external payable {
        require(sessionSigner != address(0), "session unset");
        bytes32 digest = _relayDigest(relayNonce, calls);
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        address recovered = _recover(ethSigned, sig);
        require(recovered == sessionSigner, "bad session sig");
        relayNonce++;
        _executeCalls(calls);
        emit Relayed(msg.sender, relayNonce);
        emit Executed(1, calls.length);
    }

    function _relayDigest(uint256 nonce_, Call[] calldata calls) internal pure returns (bytes32) {
        bytes memory packed;
        for (uint256 i = 0; i < calls.length; i++) {
            packed = abi.encodePacked(packed, calls[i].to, calls[i].value, calls[i].data);
        }
        return keccak256(abi.encodePacked(nonce_, packed));
    }

    function _executeCalls(Call[] calldata calls) internal {
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, ) = calls[i].to.call{value: calls[i].value}(calls[i].data);
            require(ok, "subcall fail");
        }
    }

    function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "sig len");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(hash, v, r, s);
    }

    receive() external payable {}
}

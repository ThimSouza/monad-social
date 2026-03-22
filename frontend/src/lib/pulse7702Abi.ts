export const PULSE7702_SESSION_ABI = [
  'function setSessionSigner(address signer) external',
  'function execute((address to,uint256 value,bytes data)[] calls) external payable',
  'function executeRelayed((address to,uint256 value,bytes data)[] calls, bytes sig) external payable',
  'function relayNonce() view returns (uint256)',
  'function sessionSigner() view returns (address)',
] as const;

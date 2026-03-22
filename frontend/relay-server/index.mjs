import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';

const RPC_URL = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PK = process.env.RELAYER_PRIVATE_KEY;

if (!PK) {
  console.error('Defina RELAYER_PRIVATE_KEY (hex, com 0x) e opcionalmente MONAD_RPC_URL.');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PK, provider);

const ABI = [
  'function executeRelayed((address to,uint256 value,bytes data)[] calls, bytes sig) external payable',
];

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '512kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, relayer: wallet.address });
});

app.post('/relay', async (req, res) => {
  try {
    const { userAddress, calls, sessionSig } = req.body;
    if (!userAddress || !sessionSig || !Array.isArray(calls)) {
      res.status(400).json({ error: 'userAddress, calls[], sessionSig obrigatórios' });
      return;
    }
    const c = new ethers.Contract(userAddress, ABI, wallet);
    const tuples = calls.map((x) => [x.to, BigInt(x.value || '0'), x.data || '0x']);
    const tx = await c.executeRelayed(tuples, sessionSig);
    const receipt = await tx.wait();
    res.json({ hash: receipt.hash });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.shortMessage || e?.message || String(e) });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Relay em http://localhost:${port}  relayer=${wallet.address}`);
});

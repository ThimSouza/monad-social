import { Contract, type JsonRpcSigner, type ContractTransactionReceipt, type BrowserProvider } from 'ethers';
import { POSTS_ABI, buildPulseContentUri, parsePostCreatedPostId } from '@/lib/postsContract';

/** Resolve `postId` after a tx confirms (parses `PostCreated` from the receipt). */
export async function fetchPostIdFromTx(
  provider: BrowserProvider,
  postsAddress: string,
  txHash: string
): Promise<string | null> {
  const receipt = await provider.waitForTransaction(txHash);
  if (!receipt) return null;
  return parsePostCreatedPostId(receipt, postsAddress);
}

export async function createPostWithSigner(
  signer: JsonRpcSigner,
  postsAddress: string,
  text: string,
  imageCount: number,
  ipfsCids?: string[]
): Promise<{ hash: string; postId: string | null; receipt: ContractTransactionReceipt }> {
  const uri = buildPulseContentUri(text, imageCount, ipfsCids);
  const c = new Contract(postsAddress, [...POSTS_ABI], signer);
  const tx = await c.createPost(uri);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transaction confirmed without a receipt.');
  const postId = parsePostCreatedPostId(receipt, postsAddress);
  return { hash: receipt.hash, postId, receipt };
}

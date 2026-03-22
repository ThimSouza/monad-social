/**
 * Vercel Serverless: HTTPS → Hasura on EC2 (HTTP).
 * Set HASURA_ORIGIN + HASURA_ADMIN_SECRET in Vercel (not VITE_*).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ errors: [{ message: 'Method not allowed' }] });
  }

  const origin = process.env.HASURA_ORIGIN?.replace(/\/$/, '');
  if (!origin) {
    return res.status(500).json({
      errors: [{ message: 'Server misconfiguration: HASURA_ORIGIN is not set on Vercel' }],
    });
  }

  const target = `${origin}/v1/graphql`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const secret = process.env.HASURA_ADMIN_SECRET?.trim();
  if (secret) {
    headers['x-hasura-admin-secret'] = secret;
  }

  const body =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

  try {
    const r = await fetch(target, {
      method: 'POST',
      headers,
      body,
    });
    const text = await r.text();
    res.status(r.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({
      errors: [{ message: `Hasura proxy failed: ${msg}` }],
    });
  }
}

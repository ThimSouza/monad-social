# monad-social

Monorepo: smart contracts em `contracts/`, app web (Vite + React) em `frontend/`.

## Frontend

Na **raiz do repositório** (recomendado):

```bash
npm install --prefix frontend
npm run dev
```

Ou dentro de `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

Variáveis opcionais: copia `frontend/.env.example` para `frontend/.env` (EIP-7702 / relayer).

Relay local (opcional): `cd frontend/relay-server && npm install && npm start` com `RELAYER_PRIVATE_KEY` definido.

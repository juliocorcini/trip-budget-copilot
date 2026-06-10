// One-shot smoke test: two WebSocket clients in the same room exchange a relayed message.
const BASE = 'https://trippilot-sync.trippilot.workers.dev';

const res = await fetch(`${BASE}/rooms`, { method: 'POST' });
const { code } = await res.json();
console.log('room:', code);

const wsUrl = `${BASE.replace('https', 'wss')}/rooms/${code}/ws`;

function connect(label) {
  const ws = new WebSocket(wsUrl);
  ws.addEventListener('message', (event) => console.log(`${label} <-`, event.data));
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (err) => reject(err));
  });
}

const a = await connect('A');
const b = await connect('B');
await new Promise((r) => setTimeout(r, 500));
a.send('cipher-payload-from-A');
b.send('cipher-payload-from-B');
await new Promise((r) => setTimeout(r, 1500));
a.close();
b.close();
console.log('smoke done');
process.exit(0);

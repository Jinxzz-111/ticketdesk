const http = require('http');
const { Pool } = require('pg');
const { formatMessage } = require('./message');
const pool = new Pool({
  host: process.env.DB_HOST, database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD
});
async function tick() {
  try {
    const { rows } = await pool.query('SELECT * FROM tickets WHERE notified = FALSE');
    for (const t of rows) {
      await pool.query('INSERT INTO notifications (ticket_id, message) VALUES ($1,$2)', [t.id, formatMessage(t)]);
      await pool.query('UPDATE tickets SET notified = TRUE WHERE id = $1', [t.id]);
      console.log('notified ticket', t.id);
    }
  } catch (e) { console.error('worker error:', e.message); }
}
setInterval(tick, 5000);
http.createServer((q, r) => { r.writeHead(200); r.end('{"status":"ok"}'); }).listen(3001);

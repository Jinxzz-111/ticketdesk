const express = require('express');
const STATUSES = ['open', 'in_progress', 'resolved'];
const PRIORITIES = ['low', 'medium', 'high'];

function validate(t) {
  const errors = [];
  if (!t || !t.title || t.title.trim().length < 3) errors.push('title must be at least 3 characters');
  if (t && t.priority && !PRIORITIES.includes(t.priority)) errors.push('invalid priority');
  return errors;
}

// Returns a positive integer id, or null if the text is not a valid ticket id.
function parseId(raw) {
  if (!/^[1-9]\d{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id <= 2147483647 ? id : null;   // largest value a Postgres INT can hold
}

// Lets async route handlers send database errors to the error handler below
// instead of crashing the process.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function createApp(pool) {
  const app = express();
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/', wrap(async (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ errors: ['invalid status filter'] });
    }
    const { rows } = status
      ? await pool.query('SELECT * FROM tickets WHERE status = $1 ORDER BY id DESC', [status])
      : await pool.query('SELECT * FROM tickets ORDER BY id DESC');
    res.json(rows);
  }));
  app.get('/:id', wrap(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ errors: ['invalid ticket id'] });
    const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ errors: ['ticket not found'] });
    res.json(rows[0]);
  }));
  app.post('/', wrap(async (req, res) => {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const { title, description = '', requester = 'anonymous', priority = 'medium' } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO tickets (title, description, requester, priority) VALUES ($1,$2,$3,$4) RETURNING *',
      [title.trim(), description, requester, priority]);
    res.status(201).json(rows[0]);
  }));
  app.put('/:id/status', wrap(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ errors: ['invalid ticket id'] });
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ errors: ['invalid status'] });
    const { rows } = await pool.query('UPDATE tickets SET status=$1 WHERE id=$2 RETURNING *',
      [req.body.status, id]);
    if (!rows.length) return res.status(404).json({ errors: ['ticket not found'] });
    res.json(rows[0]);
  }));
  // Any unexpected error (for example the database is down) becomes a 500 response.
  app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(500).json({ errors: ['internal server error'] });
  });
  return app;
}
module.exports = { createApp, validate, parseId, STATUSES };

const express = require('express');
const STATUSES = ['open', 'in_progress', 'resolved'];
const PRIORITIES = ['low', 'medium', 'high'];

function validate(t) {
  const errors = [];
  if (!t || !t.title || t.title.trim().length < 3) errors.push('title must be at least 3 characters');
  if (t && t.priority && !PRIORITIES.includes(t.priority)) errors.push('invalid priority');
  return errors;
}

function createApp(pool) {
  const app = express();
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM tickets ORDER BY id DESC');
    res.json(rows);
  });
  app.post('/', async (req, res) => {
    const errors = validate(req.body);
    if (errors.length) return res.status(400).json({ errors });
    const { title, description = '', requester = 'anonymous', priority = 'medium' } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO tickets (title, description, requester, priority) VALUES ($1,$2,$3,$4) RETURNING *',
      [title.trim(), description, requester, priority]);
    res.status(201).json(rows[0]);
  });
  app.put('/:id/status', async (req, res) => {
    if (!STATUSES.includes(req.body.status)) return res.status(400).json({ errors: ['invalid status'] });
    const { rows } = await pool.query('UPDATE tickets SET status=$1 WHERE id=$2 RETURNING *',
      [req.body.status, req.params.id]);
    if (!rows.length) return res.status(404).json({ errors: ['ticket not found'] });
    res.json(rows[0]);
  });
  return app;
}
module.exports = { createApp, validate, STATUSES };

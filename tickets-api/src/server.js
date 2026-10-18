const { Pool } = require('pg');
const { createApp } = require('./app');
const pool = new Pool({
  host: process.env.DB_HOST, database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD
});
createApp(pool).listen(3000, () => console.log('tickets-api on :3000'));

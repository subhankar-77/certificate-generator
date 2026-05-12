const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: 'postgresql://felicitation_user:lY4PN1EhGtH4XZBn60XiDvX2bWxScPx6@dpg-d80er350lvsc738ldvm0-a/felicitation',
  ssl: {
    rejectUnauthorized: false  // required for Render hosted PostgreSQL
  }
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL successfully');
    release();
  }
});

module.exports = pool;
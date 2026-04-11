import 'dotenv/config';
import { Client } from 'pg';

async function checkColumns() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: process.env.DATABASE_SSL_ENABLED === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  const result = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
    ORDER BY ordinal_position
  `);

  console.log('Products columns:', result.rows.map((r) => r.column_name).join(', '));

  await client.end();
}

checkColumns().catch(console.error);

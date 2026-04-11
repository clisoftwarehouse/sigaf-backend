import 'dotenv/config';
import { Client } from 'pg';

async function cleanDb() {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: process.env.DATABASE_SSL_ENABLED === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log('Connected to database');

  await client.query(`
    TRUNCATE TABLE 
      kardex, 
      inventory_lots, 
      warehouse_locations, 
      terminals, 
      products, 
      suppliers, 
      active_ingredients, 
      brands, 
      categories, 
      branches, 
      exchange_rates, 
      global_config, 
      user_sessions, 
      users, 
      permissions, 
      roles 
    CASCADE
  `);

  console.log('Database cleaned successfully!');
  await client.end();
}

cleanDb().catch(console.error);

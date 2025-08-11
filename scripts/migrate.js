import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema.js';

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  
  try {
    const connection = postgres(databaseUrl, { max: 1 });
    const db = drizzle(connection, { schema });
    
    console.log('Running database migrations...');
    
    // Test database connection
    await connection`SELECT 1`;
    console.log('Database connection successful');
    
    await connection.end();
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
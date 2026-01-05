import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool, closePool } from './index';

async function migrate() {
  console.log('Running database migrations...');
  
  try {
    const pool = getPool();
    const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    
    await pool.query(schemaSQL);
    
    console.log('✓ Migrations completed successfully');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  migrate();
}

export { migrate };

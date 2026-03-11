import * as fs from 'fs';
import { sql } from 'drizzle-orm';
import { db } from './app/server/db';

const migrationSql = fs.readFileSync('/tmp/migration.sql', 'utf-8');
const statements = migrationSql.split(';').filter(s => s.trim());

async function runMigration() {
  console.log(`Executing ${statements.length} SQL statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;
    
    try {
      console.log(`[${i+1}/${statements.length}] Executing...`);
      await db.execute(sql.raw(stmt));
      console.log(`  ✓ Success`);
    } catch (err: any) {
      console.log(`  ✗ Error: ${err.message}`);
      if (!stmt.includes('CREATE TABLE IF NOT EXISTS') && !stmt.includes('CREATE INDEX IF NOT EXISTS') && !stmt.includes('ALTER TABLE')) {
        throw err;
      }
    }
  }
  
  console.log('Migration completed!');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

const path = require('path');
const fs = require('fs');
const { createClient } = require(path.resolve('node_modules/@supabase/supabase-js'));

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val.trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testRpc() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1;' });
  console.log('rpc exec_sql:', { data, error });
}
testRpc();

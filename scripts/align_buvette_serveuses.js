const path = require('path');
const fs = require('fs');
const { createClient } = require(path.resolve('node_modules/@supabase/supabase-js'));

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val.trim();
  }
});

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function alignBuvetteServeuses() {
  const tenantId = 'f3056be1-9180-49a9-84ce-1e216489df2a';
  // Align position to SERVEUR for Yvette, Justine, Chantal
  const { data, error } = await admin.from('employees').update({ position: 'SERVEUR' }).eq('tenant_id', tenantId).in('first_name', ['Yvette', 'Justine', 'Chantal']);
  console.log('Update result:', { error });

  const { data: emps } = await admin.from('employees').select('first_name, last_name, position').eq('tenant_id', tenantId);
  console.log('LA BUVETTE DU BON COIN employees:', emps);
}

alignBuvetteServeuses().catch(console.error);

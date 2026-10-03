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

async function checkBarSanteEmployees() {
  const barSanteId = 'f6afa300-7e9e-4891-b7f6-27ab69fc42d7';
  const { data: comp } = await supabase.from('companies').select('*').eq('id', barSanteId).single();
  console.log('Company:', comp?.name, comp?.activity_type, comp?.subscription_plan, comp?.status);

  const { data: employees } = await supabase.from('employees').select('id, first_name, last_name, role, status').eq('tenant_id', barSanteId);
  console.log(`Employees count: ${employees ? employees.length : 0}`);
  if (employees) {
    const roles = {};
    employees.forEach(e => { roles[e.role] = (roles[e.role] || 0) + 1; });
    console.log('Roles distribution:', roles);
  }
}
checkBarSanteEmployees();

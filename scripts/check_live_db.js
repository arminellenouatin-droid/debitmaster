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

async function inspectTables() {
  const tables = ['plans_activite', 'parametres_globaux_abonnement', 'historique_prix_plans', 'abonnements_etablissement', 'saas_plan_prices'];
  for (const t of tables) {
    const res = await supabase.from(t).select('*');
    console.log(`Table ${t}: dataCount=${res.data ? res.data.length : 'null'}, err=${res.error ? JSON.stringify(res.error) : 'null'}`);
    if (res.data && res.data.length > 0 && t !== 'saas_plan_prices') {
      console.log(`${t} sample:`, res.data[0]);
    }
  }
}
inspectTables();

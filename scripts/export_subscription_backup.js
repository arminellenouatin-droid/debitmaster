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

async function exportBackup() {
  console.log('--- Démarrage de l’export de sauvegarde des abonnements ---');
  const [pricesRes, paymentsRes, quotesRes, companiesRes] = await Promise.all([
    supabase.from('saas_plan_prices').select('*'),
    supabase.from('saas_subscription_payments').select('*'),
    supabase.from('subscription_quote_requests').select('*'),
    supabase.from('companies').select('id, name, activity_type, subscription_plan, subscription_expires_at, trial_ends_at, status, zones_tables_enabled, payment_mode, created_at, updated_at'),
  ]);

  const backupData = {
    exportDate: new Date().toISOString(),
    saas_plan_prices: pricesRes.data || [],
    saas_subscription_payments: paymentsRes.data || [],
    subscription_quote_requests: quotesRes.data || [],
    companies: companiesRes.data || [],
  };

  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, 'backup_abonnements_pre_refonte_20261003.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');

  console.log(`Sauvegarde réussie écrite dans : ${backupPath}`);
  console.log(`- saas_plan_prices: ${backupData.saas_plan_prices.length} lignes`);
  console.log(`- saas_subscription_payments: ${backupData.saas_subscription_payments.length} lignes`);
  console.log(`- subscription_quote_requests: ${backupData.subscription_quote_requests.length} lignes`);
  console.log(`- companies: ${backupData.companies.length} établissements`);
}

exportBackup().catch(err => {
  console.error('Erreur export backup:', err);
  process.exit(1);
});

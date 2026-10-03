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

async function migrateBarSantePlus() {
  const barSanteId = 'f6afa300-7e9e-4891-b7f6-27ab69fc42d7';
  console.log(`--- Migration de l'établissement de test (${barSanteId}) ---`);

  // Vérifier l'état avant migration
  const { data: before, error: beforeErr } = await supabase
    .from('companies')
    .select('id, name, activity_type, subscription_plan, subscription_expires_at, status')
    .eq('id', barSanteId)
    .single();

  if (beforeErr || !before) {
    console.error('Erreur lecture pré-migration:', beforeErr);
    return;
  }
  console.log('État avant migration:', before);

  // Appliquer le reclassement
  const updatePayload = {
    activity_type: 'BAR_RESTAURANT',
    subscription_plan: 'BAR_RESTAURANT_SPECIAL',
    subscription_expires_at: '2099-12-31T23:59:59+00:00',
    status: 'ACTIVE',
    updated_at: new Date().toISOString(),
  };

  const { data: after, error: updateErr } = await supabase
    .from('companies')
    .update(updatePayload)
    .eq('id', barSanteId)
    .select('id, name, activity_type, subscription_plan, subscription_expires_at, status')
    .single();

  if (updateErr) {
    console.error('Erreur mise à jour:', updateErr);
    return;
  }

  console.log('État après migration (succès):', after);
}

migrateBarSantePlus();

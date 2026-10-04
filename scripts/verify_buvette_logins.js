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

const DEMO_ACCOUNTS = [
  { email: "promoteur@buvette-boncoin.com", password: "BuvetteBonCoin2026!Pro#01", expectedRole: "ADMINISTRATEUR" },
  { email: "gerant@buvette-boncoin.com", password: "BuvetteBonCoin2026!Ger#02", expectedRole: "GERANT" },
  { email: "serveuse1@buvette-boncoin.com", password: "BuvetteBonCoin2026!Srv#03", expectedRole: "SERVEUSE" },
  { email: "serveuse2@buvette-boncoin.com", password: "BuvetteBonCoin2026!Srv#04", expectedRole: "SERVEUSE" },
  { email: "serveuse3@buvette-boncoin.com", password: "BuvetteBonCoin2026!Srv#05", expectedRole: "SERVEUSE" },
  { email: "approvisionnement@buvette-boncoin.com", password: "BuvetteBonCoin2026!App#06", expectedRole: "APPROVISIONNEMENT" },
  { email: "inventaire@buvette-boncoin.com", password: "BuvetteBonCoin2026!Inv#07", expectedRole: "INVENTAIRE" },
];

async function verifyLogins() {
  console.log("=== Verifying Buvette Accounts Authentication & Profile Data ===");
  
  const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const acc of DEMO_ACCOUNTS) {
    // Client for auth sign in
    const authClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
      email: acc.email,
      password: acc.password,
    });

    if (authErr) {
      console.error(`❌ [FAILED] Sign in for ${acc.email}:`, authErr.message);
      process.exitCode = 1;
      continue;
    }

    const userId = authData.user.id;
    // Check profile
    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .select("id,tenant_id,first_name,last_name,role,status")
      .eq("id", userId)
      .single();

    if (profErr || !profile) {
      console.error(`❌ [FAILED] Profile fetch for ${acc.email}:`, profErr?.message);
      process.exitCode = 1;
      continue;
    }

    // Check employee
    const { data: emp, error: empErr } = await adminClient
      .from("employees")
      .select("id,position,status")
      .eq("user_id", userId)
      .single();

    if (empErr || !emp) {
      console.error(`❌ [FAILED] Employee record fetch for ${acc.email}:`, empErr?.message);
      process.exitCode = 1;
      continue;
    }

    console.log(`✅ [OK] ${profile.first_name} ${profile.last_name} (${acc.email}) -> Role: ${profile.role}, Employee Position: ${emp.position}, Status: ${profile.status}`);
  }

  console.log("=== Verification Finished ===");
}

verifyLogins().catch(console.error);

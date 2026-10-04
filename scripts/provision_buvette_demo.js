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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ACCOUNTS = [
  {
    firstName: "Mathieu",
    lastName: "HOUNGBO",
    email: "promoteur@buvette-boncoin.com",
    phone: "+22892000001",
    password: "BuvetteBonCoin2026!Pro#01",
    position: "ADMINISTRATEUR",
    userType: "TENANT_STAFF",
    roleLabel: "Promoteur / Propriétaire",
  },
  {
    firstName: "Pascal",
    lastName: "AGBOSSOU",
    email: "gerant@buvette-boncoin.com",
    phone: "+22892000002",
    password: "BuvetteBonCoin2026!Ger#02",
    position: "GERANT",
    userType: "TENANT_STAFF",
    roleLabel: "Gérant",
  },
  {
    firstName: "Yvette",
    lastName: "TOSSOU",
    email: "serveuse1@buvette-boncoin.com",
    phone: "+22892000003",
    password: "BuvetteBonCoin2026!Srv#03",
    position: "SERVEUSE",
    userType: "TENANT_STAFF",
    roleLabel: "Serveuse 1",
  },
  {
    firstName: "Justine",
    lastName: "AMOUZOU",
    email: "serveuse2@buvette-boncoin.com",
    phone: "+22892000004",
    password: "BuvetteBonCoin2026!Srv#04",
    position: "SERVEUSE",
    userType: "TENANT_STAFF",
    roleLabel: "Serveuse 2",
  },
  {
    firstName: "Chantal",
    lastName: "DOSSOU",
    email: "serveuse3@buvette-boncoin.com",
    phone: "+22892000005",
    password: "BuvetteBonCoin2026!Srv#05",
    position: "SERVEUSE",
    userType: "TENANT_STAFF",
    roleLabel: "Serveuse 3",
  },
  {
    firstName: "Marcel",
    lastName: "LAWSON",
    email: "approvisionnement@buvette-boncoin.com",
    phone: "+22892000006",
    password: "BuvetteBonCoin2026!App#06",
    position: "APPROVISIONNEMENT",
    userType: "TENANT_STAFF",
    roleLabel: "Chargé des approvisionnements",
  },
  {
    firstName: "Félix",
    lastName: "AMEGATSE",
    email: "inventaire@buvette-boncoin.com",
    phone: "+22892000007",
    password: "BuvetteBonCoin2026!Inv#07",
    position: "INVENTAIRE",
    userType: "TENANT_STAFF",
    roleLabel: "Chargé des inventaires",
  },
];

async function getOrCreateAuthUser(account) {
  // Check if user exists by email
  const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 500 });
  const existing = (listData?.users || []).find(
    (u) => u.email === account.email || u.phone === account.phone
  );

  if (existing) {
    console.log(`User ${account.email} already exists (${existing.id}), updating password and metadata...`);
    const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email: account.email,
      phone: account.phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        first_name: account.firstName,
        last_name: account.lastName,
        account_type: account.position === "ADMINISTRATEUR" ? "OWNER" : "STAFF",
      },
    });
    if (updateErr) console.error("Error updating user:", updateErr.message);
    return existing.id;
  }

  console.log(`Creating user ${account.email}...`);
  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    phone: account.phone,
    password: account.password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      first_name: account.firstName,
      last_name: account.lastName,
      account_type: account.position === "ADMINISTRATEUR" ? "OWNER" : "STAFF",
    },
  });

  if (error) {
    console.error(`Failed to create user ${account.email}:`, error.message);
    throw error;
  }
  return data.user.id;
}

async function runProvisioning() {
  console.log("=== Provisioning Demo Establishment: LA BUVETTE DU BON COIN ===");

  // 1. Create or get promoter auth user first
  const promoterAccount = DEMO_ACCOUNTS[0];
  const promoterUserId = await getOrCreateAuthUser(promoterAccount);

  // 2. Create or update company
  const companyName = "LA BUVETTE DU BON COIN";
  let { data: company } = await supabase
    .from("companies")
    .select("id,name,unique_code")
    .eq("name", companyName)
    .is("deleted_at", null)
    .maybeSingle();

  const trialEndsAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  if (!company) {
    console.log("Creating company", companyName);
    const { data: newCompany, error: compErr } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        unique_code: "BUVBONCOIN",
        activity_type: "BUVETTE",
        subscription_plan: "BUVETTE",
        country: "TG",
        currency: "XOF",
        status: "ACTIVE",
        trial_ends_at: trialEndsAt,
        zones_tables_enabled: true,
        owner_user_id: promoterUserId,
      })
      .select("id,name,unique_code")
      .single();

    if (compErr) {
      console.error("Failed to create company:", compErr);
      throw compErr;
    }
    company = newCompany;
  } else {
    console.log("Updating company", companyName, company.id);
    await supabase
      .from("companies")
      .update({
        activity_type: "BUVETTE",
        subscription_plan: "BUVETTE",
        trial_ends_at: trialEndsAt,
        status: "ACTIVE",
        owner_user_id: promoterUserId,
        zones_tables_enabled: true,
      })
      .eq("id", company.id);
  }

  const tenantId = company.id;
  console.log(`Tenant ID: ${tenantId}`);

  // 3. Provision all accounts (profiles + employees)
  for (const acc of DEMO_ACCOUNTS) {
    const userId = acc.position === "ADMINISTRATEUR" ? promoterUserId : await getOrCreateAuthUser(acc);

    // Profile upsert
    const { error: profErr } = await supabase.from("profiles").upsert({
      id: userId,
      tenant_id: tenantId,
      first_name: acc.firstName,
      last_name: acc.lastName,
      phone: acc.phone,
      user_type: acc.userType,
      role: acc.position,
      status: "ACTIVE",
      must_change_password: false,
    });
    if (profErr) console.error(`Error upserting profile for ${acc.email}:`, profErr.message);

    // Employee row
    const { data: existingEmp } = await supabase
      .from("employees")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingEmp) {
      const { error: empErr } = await supabase.from("employees").insert({
        tenant_id: tenantId,
        user_id: userId,
        first_name: acc.firstName,
        last_name: acc.lastName,
        phone: acc.phone,
        position: acc.position,
        status: "ACTIVE",
        must_change_password: false,
        approved_at: new Date().toISOString(),
        approved_by: promoterUserId,
        created_by: promoterUserId,
      });
      if (empErr) console.error(`Error inserting employee ${acc.email}:`, empErr.message);
      else console.log(`Employee created: ${acc.firstName} ${acc.lastName} (${acc.position})`);
    } else {
      await supabase
        .from("employees")
        .update({
          position: acc.position,
          status: "ACTIVE",
          must_change_password: false,
        })
        .eq("id", existingEmp.id);
      console.log(`Employee updated: ${acc.firstName} ${acc.lastName} (${acc.position})`);
    }
  }

  // 4. Provision Magasin de stock (1 seul magasin pour option normale)
  const { data: existingStores } = await supabase
    .from("inventory_stores")
    .select("id,name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  let storeId = existingStores?.[0]?.id;
  if (!storeId) {
    console.log("Creating Main Beverage Store...");
    const { data: store, error: storeErr } = await supabase
      .from("inventory_stores")
      .insert({
        tenant_id: tenantId,
        name: "Dépôt Boissons Central",
        store_type: "COUNTER",
        stock_family: "BEVERAGE",
        is_active: true,
        created_by: promoterUserId,
      })
      .select("id")
      .single();

    if (storeErr) console.error("Error creating store:", storeErr.message);
    else storeId = store.id;
  }

  // 5. Provision 10 Tables (max 15 pour option normale)
  const { data: existingTables } = await supabase
    .from("dining_tables")
    .select("id,label")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const existingLabels = new Set((existingTables || []).map((t) => t.label));
  const tablesToCreate = [];
  for (let i = 1; i <= 10; i++) {
    const label = `Table ${i}`;
    if (!existingLabels.has(label)) {
      tablesToCreate.push({
        tenant_id: tenantId,
        label,
        zone: i <= 5 ? "Terrasse" : "Salle Principale",
        capacity: 4,
        status: "FREE",
      });
    }
  }

  if (tablesToCreate.length > 0) {
    console.log(`Creating ${tablesToCreate.length} dining tables...`);
    const { error: tablesErr } = await supabase.from("dining_tables").insert(tablesToCreate);
    if (tablesErr) console.error("Error creating tables:", tablesErr.message);
  }

  // 6. Provision Boissons & Stock initial
  const DRINKS = [
    { name: "Bière Castel 65cl", price: 700, packaging: "Casier de 12", alert: 24, stock: 120 },
    { name: "Bière Beaufort Lager 50cl", price: 800, packaging: "Casier de 12", alert: 24, stock: 96 },
    { name: "Guinness Foreign Extra 33cl", price: 900, packaging: "Casier de 24", alert: 24, stock: 72 },
    { name: "Coca-Cola 33cl Verre", price: 500, packaging: "Casier de 24", alert: 24, stock: 144 },
    { name: "Fanta Orange 33cl Verre", price: 500, packaging: "Casier de 24", alert: 24, stock: 96 },
    { name: "Eau Minérale Possotomé 1.5L", price: 600, packaging: "Pack de 6", alert: 12, stock: 60 },
  ];

  for (const drink of DRINKS) {
    let { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", drink.name)
      .is("deleted_at", null)
      .maybeSingle();

    if (!product) {
      console.log(`Creating drink product: ${drink.name}`);
      const { data: newProd, error: prodErr } = await supabase
        .from("products")
        .insert({
          tenant_id: tenantId,
          name: drink.name,
          product_type: "UNIT",
          stock_family: "BEVERAGE",
          unit: "Bouteille",
          price: drink.price,
          packaging_label: drink.packaging,
          current_stock: drink.stock,
          alert_threshold: drink.alert,
          safety_threshold: 12,
        })
        .select("id")
        .single();

      if (prodErr) {
        console.error(`Error creating product ${drink.name}:`, prodErr.message);
        continue;
      }
      product = newProd;
    }

    if (storeId && product) {
      await supabase.from("store_inventory").upsert(
        {
          tenant_id: tenantId,
          store_id: storeId,
          product_id: product.id,
          quantity: drink.stock,
          reserved_quantity: 0,
        },
        { onConflict: "store_id,product_id" }
      );
    }
  }

  console.log("=== Provisioning Completed Successfully! ===");
}

runProvisioning().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});

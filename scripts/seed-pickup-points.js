#!/usr/bin/env node

/**
 * Seeds city_pickup_points with precise public-place pickup points.
 * Idempotent: skips rows that already exist (same city + name).
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: node scripts/seed-pickup-points.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Missing env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const seedPath = path.join(__dirname, '..', 'app', 'data', 'pickup-points-seed.json');
const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

async function seed() {
  let inserted = 0;
  let skipped = 0;

  for (const row of seedData) {
    const { error } = await supabase.from('city_pickup_points').insert({
      city: row.city,
      name: row.name,
      display_order: row.display_order ?? 0,
    });

    if (error) {
      if (error.code === '23505') {
        skipped++;
        continue;
      }
      console.error('Insert failed:', row.city, row.name, error.message);
      process.exit(1);
    }
    inserted++;
  }

  console.log(`Pickup points seed done: ${inserted} inserted, ${skipped} already existed.`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

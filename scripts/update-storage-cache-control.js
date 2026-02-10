/* eslint-disable no-console */
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Missing SUPABASE URL or service role key. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const BUCKETS = (process.env.BUCKETS ||
  "avatars,driver_documents,passenger-documents,public")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const CACHE_CONTROL = process.env.CACHE_CONTROL || "31536000";
const DRY_RUN = process.env.DRY_RUN === "1";
const MAX_BYTES = Number(process.env.MAX_BYTES || 0);

const supabase = createClient(supabaseUrl, serviceKey);

async function listAll(bucket, prefix = "") {
  let offset = 0;
  const limit = 100;
  const entries = [];

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    entries.push(...data);
    offset += limit;
  }

  return entries;
}

async function walkBucket(bucket, prefix = "") {
  const entries = await listAll(bucket, prefix);

  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.metadata && entry.metadata.mimetype) {
      await updateObject(bucket, path, entry.metadata.mimetype, entry.metadata.size);
    } else {
      await walkBucket(bucket, path);
    }
  }
}

async function updateObject(bucket, path, contentType, size) {
  if (MAX_BYTES > 0 && size && size > MAX_BYTES) {
    console.log(`[skip] ${bucket}/${path} (${size} bytes > ${MAX_BYTES})`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] ${bucket}/${path} -> cacheControl=${CACHE_CONTROL}`);
    return;
  }

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) {
    console.error(`[download error] ${bucket}/${path}`, error);
    return;
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: updateError } = await supabase.storage
    .from(bucket)
    .update(path, buffer, {
      cacheControl: CACHE_CONTROL,
      upsert: true,
      contentType: contentType || undefined,
    });

  if (updateError) {
    console.error(`[update error] ${bucket}/${path}`, updateError);
    return;
  }

  console.log(`[updated] ${bucket}/${path}`);
}

async function run() {
  console.log("Updating cache-control for buckets:", BUCKETS.join(", "));
  console.log(`Cache-Control: ${CACHE_CONTROL}`);
  if (DRY_RUN) {
    console.log("Dry run enabled. No changes will be made.");
  }

  for (const bucket of BUCKETS) {
    console.log(`\nScanning bucket: ${bucket}`);
    try {
      await walkBucket(bucket);
    } catch (error) {
      console.error(`Failed to scan bucket ${bucket}`, error);
    }
  }

  console.log("\nDone.");
}

run().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});

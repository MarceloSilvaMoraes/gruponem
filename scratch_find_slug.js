import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://alnxsarcrtpdvokfgntj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsbnhzYXJjcnRwZHZva2ZnbnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTc2OTEsImV4cCI6MjA5MDczMzY5MX0.ok7QVEoK7FxJa8i5Xq0dz7MLlxmDX4nOQCAhc7utqyI"
);

async function findSlug() {
  const { data, error } = await supabase
    .from("trigger_keywords")
    .select("typebot_url");

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Found URLs:");
  data.forEach(t => console.log(t.typebot_url));
}

findSlug();

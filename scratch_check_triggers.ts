import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function checkTriggers() {
  const { data, error } = await supabase
    .from("trigger_keywords")
    .select("*");

  if (error) {
    console.error("Error fetching triggers:", error);
    return;
  }

  console.log("Registered Triggers:");
  console.log(JSON.stringify(data, null, 2));
}

checkTriggers();

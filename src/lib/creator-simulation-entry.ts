import { supabase } from "@/integrations/supabase/client";

export const CREATOR_TEST_COMPANY_ID = "f53311c3-a40e-4b2b-b4c2-5aec852f7789";

/** Both creator entry points use the existing guarded membership helper. */
export async function enterCreatorSimulation() {
  const { error } = await supabase.rpc("enter_creator_simulation", {
    _company_id: CREATOR_TEST_COMPANY_ID,
  });
  if (error) throw new Error("Unable to enter the test tenant. Please try again.");
  // Hard navigation clears all tenant-scoped stores, as in the menu path.
  window.location.assign("/dispatch");
}
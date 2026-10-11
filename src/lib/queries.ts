import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Latest saved analyses, shared by the dashboard and the sidebar's recent list. */
export const analysesQuery = queryOptions({
  queryKey: ["analyses"],
  queryFn: async () => {
    const { data, error } = await supabase.from("analyses").select("id,title,source,source_ref,created_at,stats").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data;
  },
});

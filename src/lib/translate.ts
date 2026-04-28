import { supabase } from "@/integrations/supabase/client";

export const translateText = async (text: string, targetLang = "English"): Promise<string> => {
  const { data, error } = await supabase.functions.invoke("translate", {
    body: { text, targetLang },
  });
  if (error || !data?.translated) throw new Error("Translation failed");
  return data.translated;
};
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Role = "admin" | "student";

export const useUserRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRoles([]); setLoading(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => {
        setRoles((data ?? []).map((r: any) => r.role as Role));
        setLoading(false);
      });
  }, [user]);

  return {
    roles,
    loading,
    isAdmin: roles.includes("admin"),
    isOrganizer: roles.includes("admin"), // admins can post events
    isStudent: roles.includes("student"),
  };
};

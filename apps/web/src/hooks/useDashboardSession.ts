"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type CopaUser = {
  id?: number;
  username?: string;
  name?: string;
  role?: string;
};

export function useDashboardSession() {
  const router = useRouter();
  const [user, setUser] = useState<CopaUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("copa_user");
    const token = localStorage.getItem("copa_token");
    if (!storedUser || !token) {
      router.replace("/login");
      return;
    }
    try {
      setUser(JSON.parse(storedUser) as CopaUser);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const logout = useCallback(() => {
    if (confirm("¿Está seguro que desea cerrar sesión?")) {
      localStorage.removeItem("copa_token");
      localStorage.removeItem("copa_user");
      router.push("/login");
    }
  }, [router]);

  const displayName = user?.name || user?.username || "Usuario";

  return { user, displayName, logout, ready: user !== null };
}

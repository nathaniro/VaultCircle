"use client";

import { useEffect, useState } from "react";
import { getMember } from "./stacks";
import type { Member } from "@/types";

export function useVaultMembership(vaultId: number | null, address: string | null) {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMembership() {
      if (vaultId === null || !address) {
        setMember(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const currentMember = await getMember(vaultId, address);
        if (!cancelled) {
          setMember(currentMember);
        }
      } catch {
        if (!cancelled) {
          setMember(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMembership();

    return () => {
      cancelled = true;
    };
  }, [address, vaultId]);

  return {
    member,
    loading,
    isMember: Boolean(member?.active)
  };
}

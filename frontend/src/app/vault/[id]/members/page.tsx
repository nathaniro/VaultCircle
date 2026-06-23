"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import { useWallet } from "@/lib/wallet";
import { getMember, getMemberAt, getVault } from "@/lib/stacks";
import { formatAppError, normalizeUint } from "@/lib/validation";
import { calcRequiredApprovals, satsTosBTC } from "@/types";
import type { Member, Vault } from "@/types";

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const vaultId = normalizeUint(id);
  const { address } = useWallet();

  const [vault, setVault] = useState<Vault | null>(null);
  const [members, setMembers] = useState<(Member & { address: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError("");

      if (vaultId === null) {
        setVault(null);
        setMembers([]);
        setLoadError("We could not load the member list because the vault ID in the URL is invalid.");
        setLoading(false);
        return;
      }

      try {
        const currentVault = await getVault(vaultId, { skipZest: true });
        if (cancelled) return;
        setVault(currentVault);

        if (!currentVault) {
          setMembers([]);
          setLoadError("The vault could not be found on the selected Stacks Testnet deployment.");
          setLoading(false);
          return;
        }

        const memberList: (Member & { address: string })[] = [];
        for (let index = 0; index < currentVault.memberCount + 5 && memberList.length < currentVault.memberCount; index += 1) {
          const memberAddress = await getMemberAt(vaultId, index);
          if (!memberAddress) continue;

          const memberData = await getMember(vaultId, memberAddress);
          if (memberData) memberList.push({ ...memberData, address: memberAddress });
        }

        if (cancelled) return;
        setMembers(memberList);
      } catch (error) {
        if (cancelled) return;
        setVault(null);
        setMembers([]);
        setLoadError(formatAppError(error, "We could not load the member list for this vault right now."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="surface-card h-96 skeleton" />
      </div>
    );
  }

  if (!vault || vaultId === null) {
    return (
      <div className="page-wrap">
        <EmptyState
          title="Vault members are unavailable"
          description={loadError || "The vault could not be loaded, so the membership list cannot be shown for this route."}
          actionHref={`/vaults`}
          actionLabel="Back to Dashboard"
        />
      </div>
    );
  }

  const totalContributed = vault.totalContributed;
  const required = calcRequiredApprovals(vault.memberCount, vault.thresholdPercent);

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow="Member Directory"
        title={`Members of ${vault.name}`}
        description="See who participates in the vault, how contribution shares are distributed, and how many signers are required before treasury actions execute."
        backHref={`/vault/${vaultId}`}
        backLabel="Back to vault overview"
        actions={
          <Link href={`/vault/${vaultId}/create-proposal`} className="btn-secondary">
            Propose Member Change
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="table-shell">
          <div className="grid gap-3 px-6 py-5 text-sm text-slate-400 md:grid-cols-[2fr_1fr_1fr_0.8fr]">
            <span>Member</span>
            <span>Contribution</span>
            <span>Share</span>
            <span>Status</span>
          </div>
          {members.map((member) => {
            const sharePercent = totalContributed > 0 ? ((member.contributed / totalContributed) * 100).toFixed(2) : "0.00";
            const isYou = member.address === address;

            return (
              <div key={member.address} className="table-row grid gap-3 px-6 py-5 md:grid-cols-[2fr_1fr_1fr_0.8fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm text-slate-200 break-all">{member.address}</p>
                    {isYou && <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-200">You</span>}
                    {member.address === vault.creator && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-300">Creator</span>}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Joined at block {member.joinedAt}</p>
                </div>
                <p className="text-sm font-semibold text-white">{satsTosBTC(member.contributed)} sBTC</p>
                <p className="text-sm font-semibold text-amber-300">{sharePercent}%</p>
                <div>
                  <span className={member.active ? "badge-active" : "badge-executed"}>{member.active ? "Active" : "Removed"}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <InfoCard
            title="How voting works here"
            tone="brand"
            description={`${required} member approval${required !== 1 ? "s are" : " is"} required because this vault has ${vault.memberCount} active members and a ${vault.thresholdPercent}% threshold.`}
          />
          <InfoCard
            title="Contribution share"
            description="Contribution share affects group distributions and close-out payouts, but every active member still has one vote when proposals are approved or rejected."
          />
          <InfoCard
            title="Changing membership"
            description="Members are added or removed through proposals. That means the group reviews the change before the contract updates the participant set."
          />
        </div>
      </div>
    </div>
  );
}

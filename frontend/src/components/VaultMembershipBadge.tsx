interface VaultMembershipBadgeProps {
  creator?: boolean;
  compact?: boolean;
  label?: string;
}

export default function VaultMembershipBadge({
  creator = false,
  compact = false,
  label
}: VaultMembershipBadgeProps) {
  const primaryLabel = label ?? (creator ? "Creator Member" : "Vault Member");
  const secondaryLabel = creator ? "Origin Signer" : "Access Active";

  if (compact) {
    return (
      <span className="badge-member-elite badge-member-compact">
        <span className="badge-member-orb" aria-hidden="true" />
        <span className="badge-member-copy">
          <span className="badge-member-title">{primaryLabel}</span>
        </span>
      </span>
    );
  }

  return (
    <span className="badge-member-elite">
      <span className="badge-member-orb" aria-hidden="true" />
      <span className="badge-member-copy">
        <span className="badge-member-title">{primaryLabel}</span>
        <span className="badge-member-subtitle">{secondaryLabel}</span>
      </span>
    </span>
  );
}

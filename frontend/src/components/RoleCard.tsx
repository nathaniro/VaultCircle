interface RoleCardProps {
  title: string;
  description: string;
  bullets: string[];
}

export default function RoleCard({ title, description, bullets }: RoleCardProps) {
  return (
    <div className="surface-card surface-card-interactive">
      <h3 className="text-xl font-semibold text-ink-50">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-ink-400">{description}</p>
      <div className="mt-5 space-y-3">
        {bullets.map((bullet) => (
          <div key={bullet} className="flex items-start gap-3 text-sm text-ink-300">
            <span className="mt-1 h-2 w-2 rounded-full bg-orange-300" />
            <span>{bullet}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

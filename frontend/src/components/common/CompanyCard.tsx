import type { Company } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function CompanyLogo({
  company,
  size = 40,
  className,
}: {
  company: Pick<Company, "logoColor" | "logoInitials">;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: company.logoColor,
        fontSize: size * 0.38,
      }}
    >
      {company.logoInitials}
    </div>
  );
}

export function CompanyCard({ company, right }: { company: Company; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <CompanyLogo company={company} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{company.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {company.industry} · {company.country}
        </p>
      </div>
      {right}
    </div>
  );
}

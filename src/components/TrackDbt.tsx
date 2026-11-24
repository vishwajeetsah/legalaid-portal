import { useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Search, XCircle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { usePortal, type Application } from "@/lib/portal-store";
import { isDbtRef } from "@/lib/app-number";

const inputClass =
  "interactive-card w-full rounded-lg border-2 border-input bg-background px-4 py-3 font-mono text-lg tracking-wide uppercase focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STAGE_KEYS = ["dbtStage0", "dbtStage1", "dbtStage2", "dbtStage3"] as const;

export function TrackDbt() {
  const { t } = useLang();
  const { data } = usePortal();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Application | null>(null);

  const search = () => {
    setError(null);
    setFound(null);
    const q = query.trim().toUpperCase();
    if (!isDbtRef(q)) {
      setError(t("dbtBadFormat"));
      return;
    }
    const app = data.applications.find((a) => a.dbt?.ref === q);
    if (!app) {
      setError(t("dbtNotFound"));
      return;
    }
    setFound(app);
  };

  return (
    <div className="card-enter rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("dbtTrackTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("dbtTrackHelp")}</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="DLSA-VC-2026-00891"
          aria-label={t("dbtRefLabel")}
          className={inputClass}
        />
        <button
          type="button"
          onClick={search}
          className="tactile-button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {t("trackButton")}
        </button>
      </div>

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-base font-medium text-destructive">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {found?.dbt && (
        <div className="mt-6">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-mono text-lg font-bold text-primary">{found.dbt.ref}</p>
            <p className="mt-1 text-base">
              {t("dbtFor")}: {found.applicantName} · {found.districtName}, {found.stateName}
            </p>
            {found.dbt.amount != null && (
              <p className="mt-1 text-base">
                {t("sanctionedAmount")}: <span className="font-bold text-primary">₹{found.dbt.amount.toLocaleString("en-IN")}</span>
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {STAGE_KEYS.map((key, i) => {
              const done = i <= found.dbt!.stage;
              const current = i === found.dbt!.stage;
              const date = found.dbt!.stageDates[i];
              return (
                <div key={key} className="relative">
                  {i < STAGE_KEYS.length - 1 && (
                    <ArrowRight className="absolute top-5 -right-3 z-10 hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
                  )}
                  <div
                    className={`rounded-lg border-2 p-4 text-center ${
                      done ? "border-success bg-success/10" : "border-border bg-background"
                    } ${current && found.dbt!.stage < 3 ? "ring-2 ring-accent" : ""}`}
                  >
                    {done ? (
                      <CheckCircle2 className="mx-auto h-6 w-6 text-success" aria-hidden="true" />
                    ) : (
                      <Circle className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                    )}
                    <p className={`mt-2 font-semibold ${done ? "text-primary" : "text-muted-foreground"}`}>{t(key)}</p>
                    {date && <p className="mt-1 text-sm text-muted-foreground">{fmtDate(date)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

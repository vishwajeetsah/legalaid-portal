import { useState } from "react";
import { CheckCircle2, Circle, FileText, Search, UserRound, XCircle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { usePortal, type Application } from "@/lib/portal-store";
import { validateApplicationNumber } from "@/lib/app-number";
import { DOCUMENTS, DISPUTES } from "@/data/legalAid";

const inputClass =
  "interactive-card w-full rounded-lg border-2 border-input bg-background px-4 py-3 font-mono text-lg tracking-wide uppercase focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type Milestone = { label: string; date: string | null; done: boolean; current: boolean };

function milestones(a: Application, t: (k: never) => string): Milestone[] {
  const tt = t as (k: string) => string;
  const rejected = a.decision === "rejected";
  const list: Milestone[] = [
    { label: tt("statusSubmitted"), date: a.submittedAt, done: true, current: false },
    {
      label: tt("statusScrutiny"),
      date: a.scrutiny?.at ?? null,
      done: Boolean(a.scrutiny) || a.stage !== "clerk",
      current: a.stage === "clerk" && !a.scrutiny,
    },
    {
      label: tt("statusSecretary"),
      date: null,
      done: a.stage === "decided",
      current: a.stage === "secretary",
    },
  ];
  if (rejected) {
    list.push({ label: tt("statusRejected"), date: a.decisionAt ?? null, done: true, current: false });
    return list;
  }
  list.push({
    label: tt("statusApproved"),
    date: a.decisionAt ?? null,
    done: a.decision === "approved",
    current: false,
  });
  list.push({
    label: tt("statusAdvocate"),
    date: null,
    done: Boolean(a.advocate),
    current: a.decision === "approved" && !a.advocate,
  });
  list.push({
    label: tt("statusCourt"),
    date: null,
    done: Boolean(a.cnr),
    current: Boolean(a.advocate) && !a.cnr,
  });
  return list;
}

export function TrackApplication() {
  const { t, b } = useLang();
  const { data } = usePortal();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Application | null>(null);

  const search = () => {
    setError(null);
    setFound(null);
    const v = validateApplicationNumber(query);
    if (!v.ok) {
      setError(v.reason === "checksum" ? t("trackBadChecksum") : t("trackBadFormat"));
      return;
    }
    const app = data.applications.find((a) => a.id === query.trim().toUpperCase());
    if (!app) {
      setError(t("trackNotFound"));
      return;
    }
    setFound(app);
  };

  const docKeys = found ? Array.from(new Set(["identity", "photo", ...(found.kind === "VC" ? ["fir"] : [])])) : [];

  return (
    <div className="card-enter rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("trackTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{t("trackHelp")}</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="MP15-LA-241126-0042-5"
          aria-label={t("appNumberLabel")}
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

      {found && (
        <div className="mt-6">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="font-mono text-lg font-bold text-primary">{found.id}</p>
            <p className="mt-1 text-base">
              {found.applicantName} · {found.districtName}, {found.stateName}
              {found.kind === "VC" ? ` · ${t("claimTypeVC")}` : ` · ${t("claimTypeLA")}`}
            </p>
            {found.transfers.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("transferredNote")}: {found.transfers.map((tr) => `${tr.fromDistrict} → ${tr.toDistrict}`).join("; ")}
              </p>
            )}
          </div>

          <ol className="mt-6 space-y-0">
            {milestones(found, t as (k: never) => string).map((m, i, arr) => (
              <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                {i < arr.length - 1 && (
                  <span className={`absolute top-6 left-[11px] h-[calc(100%-20px)] w-0.5 ${m.done ? "bg-success" : "bg-border"}`} aria-hidden="true" />
                )}
                {m.done ? (
                  <CheckCircle2 className="z-10 h-6 w-6 shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <Circle className={`z-10 h-6 w-6 shrink-0 ${m.current ? "text-accent" : "text-muted-foreground"}`} aria-hidden="true" />
                )}
                <div>
                  <p className={`text-lg ${m.done ? "font-semibold text-primary" : m.current ? "font-semibold" : "text-muted-foreground"}`}>{m.label}</p>
                  {m.date && <p className="text-sm text-muted-foreground">{fmtDate(m.date)}</p>}
                </div>
              </li>
            ))}
          </ol>

          {found.cnr && (
            <p className="mt-2 rounded-lg border border-border bg-background px-4 py-3 text-base">
              CNR: <span className="font-mono font-bold text-primary">{found.cnr}</span>
            </p>
          )}

          {found.advocate && (
            <div className="mt-4 rounded-lg border border-border bg-background p-4">
              <p className="flex items-center gap-2 font-serif text-lg font-bold text-primary">
                <UserRound className="h-5 w-5" aria-hidden="true" />
                {t("assignedAdvocate")}
              </p>
              <p className="mt-2 text-lg font-semibold">{found.advocate.name}</p>
              <p className="text-base text-muted-foreground">{found.advocate.phone}</p>
            </div>
          )}

          {found.reportingSlip && (
            <div className="mt-4 rounded-lg border-2 border-accent bg-accent/10 p-4">
              <p className="flex items-center gap-2 font-serif text-lg font-bold text-primary">
                <FileText className="h-5 w-5" aria-hidden="true" />
                {t("reportingSlipTitle")}
              </p>
              <dl className="mt-3 space-y-2 text-base">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-primary">{t("reportingDate")}:</dt>
                  <dd>{fmtDate(found.reportingSlip.date)}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-primary">{t("courtAddress")}:</dt>
                  <dd>{found.reportingSlip.courtAddress}</dd>
                </div>
              </dl>
              <p className="mt-3 font-semibold text-primary">{t("carryDocuments")}</p>
              <ul className="mt-1 list-inside list-disc text-base">
                {docKeys.map((k) => (
                  <li key={k}>{b(DOCUMENTS[k] ?? DOCUMENTS["identity"]!)}</li>
                ))}
                {found.kind === "LA" && found.dispute && DISPUTES.find((d) => d.id === found.dispute) && (
                  <li>
                    {t("q3Title")}: {b(DISPUTES.find((d) => d.id === found.dispute)!.label)}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

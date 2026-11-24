import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  CheckCircle2,
  FileText,
  Gavel,
  LogOut,
  RotateCcw,
  Send,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { usePortal, advocatesFor, ageDays, isSlaBreach, statusLabel, type Application } from "@/lib/portal-store";
import { evaluate, type Answers } from "@/lib/eligibility";
import { INDIA_STATES, findDistrict, findState } from "@/data/india";
import { DISPUTES, DOCUMENTS, RULES } from "@/data/legalAid";

export const Route = createFileRoute("/official/dashboard")({
  head: () => ({
    meta: [{ title: "Official Dashboard (Demo) — LegalAid India Portal" }],
  }),
  component: Dashboard,
});

const inputClass =
  "w-full rounded-lg border-2 border-input bg-background px-3 py-2 text-base focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const selectClass = inputClass;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Pill({ tone, children }: { tone: "brown" | "green" | "red" | "gold" | "grey"; children: React.ReactNode }) {
  const cls =
    tone === "green"
      ? "bg-success/15 text-success border-success/40"
      : tone === "red"
        ? "bg-destructive/10 text-destructive border-destructive/40"
        : tone === "gold"
          ? "bg-accent/15 text-primary border-accent/50"
          : tone === "grey"
            ? "bg-muted text-muted-foreground border-border"
            : "bg-primary/10 text-primary border-primary/30";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
}

function statusPill(a: Application) {
  if (a.decision === "rejected") return <Pill tone="red">Rejected</Pill>;
  if (a.cnr) return <Pill tone="green">Court Registered</Pill>;
  if (a.advocate) return <Pill tone="green">Advocate Assigned</Pill>;
  if (a.decision === "approved") return <Pill tone="green">Approved</Pill>;
  if (a.stage === "secretary") return <Pill tone="gold">With Member Secretary</Pill>;
  return <Pill tone="brown">Under Scrutiny</Pill>;
}

function verdictOf(a: Application) {
  const answers: Answers = {
    stateCode: a.stateCode,
    district: a.district,
    taluk: "",
    categories: a.categories,
    incomeUnderCap: a.incomeUnderCap,
    dispute: a.dispute,
    applicantName: a.applicantName,
    fatherName: a.fatherName,
    address: a.address,
    phone: a.phone,
    gender: a.gender,
    dob: a.dob,
    oppositeParty: a.oppositeParty,
    oppositeUnknown: !a.oppositeParty,
    relief: a.relief,
    previousApplication: false,
    casePending: false,
    incomeUncertain: a.incomeUncertain,
    scanUsed: false,
    pin: "",
  };
  return evaluate(answers);
}

function AppDetail({ a }: { a: Application }) {
  const verdict = verdictOf(a);
  const disputeLabel =
    a.kind === "VC"
      ? { "sexual-assault": "Sexual assault", "acid-attack": "Acid attack", "other-crime": "Another serious crime" }[a.incidentType ?? ""] ?? a.dispute
      : (DISPUTES.find((d) => d.id === a.dispute)?.label.en ?? a.dispute);
  const rows: [string, string][] = [
    ["Applicant", a.applicantName],
    ["Father's / Husband's name", a.fatherName || "—"],
    ["Gender / DOB", `${a.gender || "—"} / ${a.dob || "—"}`],
    ["Address (identity only)", a.address || "—"],
    ["Mobile", a.phone || "—"],
    ["Kind", a.kind === "VC" ? "Victim Compensation" : "Legal Aid"],
    ...(a.kind === "LA"
      ? ([
          ["Section 12 categories", a.categories.length ? a.categories.map((c) => RULES.categories.find((r) => r.id === c)?.label.en ?? c).join(", ") : "None claimed"],
          ["Income below state limit", a.incomeUncertain ? "Uncertain — to be confirmed" : a.incomeUnderCap === null ? "—" : a.incomeUnderCap ? "Yes" : "No"],
          ["Dispute", disputeLabel],
          ["Opposite party", a.oppositeParty || "Not known"],
          ["Relief sought", a.relief === "advice" ? "Legal advice only" : "File a case"],
        ] as [string, string][])
      : ([
          ["Incident", disputeLabel],
          ["FIR", a.firNumber || "—"],
          ["Police station", a.policeStation || "—"],
        ] as [string, string][])),
    ["Routed to (dispute district)", `DLSA ${a.districtName}, ${a.stateName}`],
    ["Submitted", fmtDate(a.submittedAt)],
    ["System eligibility check", verdict.eligible ? `Eligible — ${verdict.sections.join(", ")}` : "Not eligible on the answers given"],
  ];
  return (
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <p key={k} className="text-sm">
          <span className="font-semibold text-primary">{k}: </span>
          {v}
        </p>
      ))}
      {a.scrutiny && (
        <p className="text-sm sm:col-span-2">
          <span className="font-semibold text-primary">Clerk scrutiny: </span>
          {a.scrutiny.note} <span className="text-muted-foreground">({a.scrutiny.by}, {fmtDate(a.scrutiny.at)})</span>
        </p>
      )}
      {a.transfers.map((tr, i) => (
        <p key={i} className="text-sm sm:col-span-2">
          <span className="font-semibold text-primary">Transfer: </span>
          {tr.fromDistrict} → {tr.toDistrict} by {tr.by} on {fmtDate(tr.at)} (jurisdiction)
        </p>
      ))}
    </div>
  );
}

function QueueTable({
  apps,
  selectedId,
  onSelect,
  emptyText,
}: {
  apps: Application[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  emptyText: string;
}) {
  if (apps.length === 0) return <p className="rounded-lg border border-border bg-background px-4 py-6 text-center text-muted-foreground">{emptyText}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="px-3 py-2 font-semibold">Application No.</th>
            <th className="px-3 py-2 font-semibold">Applicant</th>
            <th className="px-3 py-2 font-semibold">Kind</th>
            <th className="px-3 py-2 font-semibold">Submitted</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">SLA</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr
              key={a.id}
              onClick={() => onSelect(selectedId === a.id ? null : a.id)}
              className={`cursor-pointer border-t border-border ${selectedId === a.id ? "bg-primary/5" : "bg-card hover:bg-muted/50"}`}
            >
              <td className="px-3 py-2 font-mono text-[13px] font-bold text-primary">{a.id}</td>
              <td className="px-3 py-2">{a.applicantName}</td>
              <td className="px-3 py-2">{a.kind}</td>
              <td className="px-3 py-2">{fmtDate(a.submittedAt)}</td>
              <td className="px-3 py-2">{statusPill(a)}</td>
              <td className="px-3 py-2">
                {isSlaBreach(a) ? (
                  <Pill tone="red">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {ageDays(a)}d — breach
                  </Pill>
                ) : (
                  <span className="text-muted-foreground">{ageDays(a)}d</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClerkPanel({ a, officialName }: { a: Application; officialName: string }) {
  const { clerkForward, clerkTransfer } = usePortal();
  const [checks, setChecks] = useState({ identity: false, ground: false, docs: false });
  const [note, setNote] = useState("");
  const [tState, setTState] = useState("");
  const [tDistrict, setTDistrict] = useState("");
  const allChecked = checks.identity && checks.ground && checks.docs;
  const tStateObj = findState(tState);

  return (
    <div className="mt-3 rounded-lg border border-border bg-background p-4">
      <AppDetail a={a} />
      <div className="mt-4 border-t border-border pt-4">
        <p className="font-semibold text-primary">Document & eligibility scrutiny</p>
        <div className="mt-2 space-y-2">
          {(
            [
              ["identity", "Identity verified (Aadhaar / ID proof matches the applicant)"],
              ["ground", a.kind === "VC" ? "Incident & FIR details verified" : "Eligibility ground verified (Section 12 category / income)"],
              ["docs", "Documents complete for the Member Secretary"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-base">
              <input
                type="checkbox"
                checked={checks[key]}
                onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
                className="h-5 w-5 accent-[oklch(0.390_0.082_77)]"
              />
              {label}
            </label>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block font-semibold text-primary">Scrutiny note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="e.g. ID and documents verified. File is complete." />
        </label>
        <button
          type="button"
          disabled={!allChecked}
          onClick={() => clerkForward(a.id, `Front Office Clerk, DLSA ${a.districtName} (${officialName})`, note.trim() || "Scrutiny complete. Documents verified.")}
          className="tactile-button mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" /> Forward to Member Secretary
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="flex items-center gap-2 font-semibold text-primary">
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" /> Transfer jurisdiction (wrong dispute district)
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          The file moves to the correct DLSA. The citizen keeps the <strong>same application number</strong>.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <select value={tState} onChange={(e) => { setTState(e.target.value); setTDistrict(""); }} className={selectClass} aria-label="Transfer to state">
            <option value="">State…</option>
            {INDIA_STATES.map((s) => (
              <option key={s.code} value={String(s.code)}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={tDistrict} onChange={(e) => setTDistrict(e.target.value)} disabled={!tStateObj} className={selectClass} aria-label="Transfer to district">
            <option value="">District…</option>
            {(tStateObj?.districts ?? []).map((d) => (
              <option key={d.code} value={String(d.code)}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!tDistrict || (tState === a.stateCode && tDistrict === a.district)}
            onClick={() => clerkTransfer(a.id, tState, tDistrict, `Front Office Clerk, DLSA ${a.districtName} (${officialName})`)}
            className="tactile-button rounded-lg border-2 border-primary bg-card px-4 py-2 font-bold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Transfer file
          </button>
        </div>
      </div>
    </div>
  );
}

function SecretaryDecisionPanel({ a }: { a: Application }) {
  const { secretaryDecide } = usePortal();
  const [amount, setAmount] = useState("");
  return (
    <div className="mt-3 rounded-lg border border-border bg-background p-4">
      <AppDetail a={a} />
      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        {a.kind === "VC" && (
          <label className="block">
            <span className="mb-1 block font-semibold text-primary">Compensation amount on approval (₹)</span>
            <input value={amount} inputMode="numeric" onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className={`${inputClass} w-48`} placeholder="400000" />
          </label>
        )}
        <button
          type="button"
          onClick={() => secretaryDecide(a.id, "approved", a.kind === "VC" ? Number(amount) || 300000 : undefined)}
          className="tactile-button inline-flex items-center gap-2 rounded-lg bg-success px-5 py-3 font-bold text-success-foreground hover:opacity-90"
        >
          <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Approve
        </button>
        <button
          type="button"
          onClick={() => secretaryDecide(a.id, "rejected")}
          className="tactile-button inline-flex items-center gap-2 rounded-lg bg-destructive px-5 py-3 font-bold text-white hover:opacity-90"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" /> Reject
        </button>
      </div>
      {a.kind === "VC" && <p className="mt-2 text-sm text-muted-foreground">Approving sanctions the compensation — the DBT pipeline moves to “Sanctioned”.</p>}
    </div>
  );
}

function SecretaryManagePanel({ a }: { a: Application }) {
  const { assignAdvocate, enterCNR, issueSlip, dbtAdvance } = usePortal();
  const advocates = advocatesFor(a.districtName);
  const [adv, setAdv] = useState("");
  const [cnr, setCnr] = useState("");
  const [slipDate, setSlipDate] = useState("");
  const dbtStageNames = ["Verified", "Sanctioned", "Sent to Bank (PFMS)", "Credited"];

  return (
    <div className="mt-3 rounded-lg border border-border bg-background p-4">
      <AppDetail a={a} />
      <div className="mt-4 grid gap-5 border-t border-border pt-4 lg:grid-cols-2">
        {a.kind === "LA" && (
          <>
            <div>
              <p className="flex items-center gap-2 font-semibold text-primary">
                <UserRound className="h-4 w-4" aria-hidden="true" /> Assign panel advocate
              </p>
              {a.advocate ? (
                <p className="mt-2 text-base">
                  <span className="font-semibold">{a.advocate.name}</span> · {a.advocate.phone}
                  <span className="mt-1 block text-sm text-success">{a.dispatchNote}</span>
                </p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <select value={adv} onChange={(e) => setAdv(e.target.value)} className={selectClass} aria-label="Panel advocate">
                    <option value="">Select advocate…</option>
                    {advocates.map((p) => (
                      <option key={p.phone} value={p.phone}>
                        {p.name} — {p.phone}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!adv}
                    onClick={() => {
                      const p = advocates.find((x) => x.phone === adv);
                      if (p) assignAdvocate(a.id, p);
                    }}
                    className="tactile-button shrink-0 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Assign & dispatch
                  </button>
                </div>
              )}
              {advocates.length === 0 && !a.advocate && (
                <p className="mt-1 text-sm text-muted-foreground">No panel list seeded for this district in the demo.</p>
              )}
            </div>

            <div>
              <p className="flex items-center gap-2 font-semibold text-primary">
                <Gavel className="h-4 w-4" aria-hidden="true" /> Court registration (CNR)
              </p>
              {a.cnr ? (
                <p className="mt-2 text-base">
                  CNR: <span className="font-mono font-bold text-primary">{a.cnr}</span>
                  <span className="block text-sm text-muted-foreground">Loop closed — the case now lives on eCourts.</span>
                </p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input value={cnr} onChange={(e) => setCnr(e.target.value)} className={inputClass} placeholder="e.g. MPJC040012342026" aria-label="CNR number" />
                  <button
                    type="button"
                    disabled={cnr.trim().length < 8}
                    onClick={() => enterCNR(a.id, cnr)}
                    className="tactile-button shrink-0 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Save CNR
                  </button>
                </div>
              )}
              <p className="mt-4 flex items-center gap-2 font-semibold text-primary">
                <FileText className="h-4 w-4" aria-hidden="true" /> Court Reporting Slip
              </p>
              {a.reportingSlip ? (
                <p className="mt-2 text-base">
                  Reporting date: <span className="font-semibold">{fmtDate(a.reportingSlip.date)}</span>
                  <span className="block text-sm text-muted-foreground">{a.reportingSlip.courtAddress}</span>
                </p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input type="date" value={slipDate} onChange={(e) => setSlipDate(e.target.value)} className={inputClass} aria-label="Reporting date" />
                  <button
                    type="button"
                    disabled={!slipDate}
                    onClick={() => issueSlip(a.id, slipDate)}
                    className="tactile-button shrink-0 rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Issue slip
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {a.kind === "VC" && a.dbt && (
          <div>
            <p className="flex items-center gap-2 font-semibold text-primary">
              <Wallet className="h-4 w-4" aria-hidden="true" /> Victim Compensation DBT — {a.dbt.ref}
            </p>
            <ol className="mt-3 space-y-2">
              {dbtStageNames.map((name, i) => (
                <li key={name} className="flex items-center gap-2 text-base">
                  {i <= a.dbt!.stage ? (
                    <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                  ) : (
                    <span className="h-5 w-5 rounded-full border-2 border-border" aria-hidden="true" />
                  )}
                  <span className={i <= a.dbt!.stage ? "font-semibold text-primary" : "text-muted-foreground"}>{name}</span>
                  {a.dbt!.stageDates[i] && <span className="text-sm text-muted-foreground">{fmtDate(a.dbt!.stageDates[i]!)}</span>}
                </li>
              ))}
            </ol>
            {a.dbt.amount != null && <p className="mt-2 text-base">Sanctioned amount: <span className="font-bold text-primary">₹{a.dbt.amount.toLocaleString("en-IN")}</span></p>}
            <button
              type="button"
              disabled={a.dbt.stage >= 3}
              onClick={() => dbtAdvance(a.id)}
              className="tactile-button mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {a.dbt.stage === 1 ? "Send to Bank (PFMS)" : a.dbt.stage === 2 ? "Mark Credited" : "Advance DBT stage"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MonitorView() {
  const { data } = usePortal();
  const apps = data.applications;
  const undecided = apps.filter((a) => a.stage !== "decided");
  const breaches = apps.filter(isSlaBreach);
  const dbtApps = apps.filter((a) => a.dbt);
  const sanctionedTotal = dbtApps.filter((a) => (a.dbt?.stage ?? 0) >= 1).reduce((s, a) => s + (a.dbt?.amount ?? 0), 0);
  const creditedTotal = dbtApps.filter((a) => a.dbt?.stage === 3).reduce((s, a) => s + (a.dbt?.amount ?? 0), 0);

  const byDistrict = useMemo(() => {
    const map = new Map<string, { total: number; pending: number; oldest: number }>();
    for (const a of apps) {
      const key = `${a.districtName}, ${a.stateName}`;
      const cur = map.get(key) ?? { total: 0, pending: 0, oldest: 0 };
      cur.total += 1;
      if (a.stage !== "decided") {
        cur.pending += 1;
        cur.oldest = Math.max(cur.oldest, ageDays(a));
      }
      map.set(key, cur);
    }
    return Array.from(map.entries()).sort((x, y) => y[1].pending - x[1].pending);
  }, [apps]);

  const stats: [string, number][] = [
    ["Total applications", apps.length],
    ["Legal Aid (LA)", apps.filter((a) => a.kind === "LA").length],
    ["Victim Compensation (VC)", apps.filter((a) => a.kind === "VC").length],
    ["Under scrutiny (Clerk)", apps.filter((a) => a.stage === "clerk").length],
    ["With Member Secretary", apps.filter((a) => a.stage === "secretary").length],
    ["Approved", apps.filter((a) => a.decision === "approved").length],
    ["Rejected", apps.filter((a) => a.decision === "rejected").length],
    ["Advocate assigned", apps.filter((a) => a.advocate).length],
    ["Court registered (CNR)", apps.filter((a) => a.cnr).length],
  ];

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-accent/60 bg-accent/10 px-4 py-3 text-sm font-semibold text-primary">
        Demonstration — simulated data. Read-only oversight across all districts, as an SLSA / NALSA monitor would see it.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
            <p className="font-serif text-3xl font-bold text-primary">{n}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {breaches.length > 0 && (
        <section className="rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4">
          <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" /> SLA breaches — pending over 7 days ({breaches.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {breaches.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm">
                <span className="font-mono font-bold text-primary">{a.id}</span>
                <span>{a.applicantName}</span>
                <span>{a.districtName}, {a.stateName}</span>
                <span>{statusLabel(a)}</span>
                <Pill tone="red">{ageDays(a)} days</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-serif text-lg font-bold text-primary">Pendency by district</h3>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-3 py-2 font-semibold">District</th>
                <th className="px-3 py-2 font-semibold">Total</th>
                <th className="px-3 py-2 font-semibold">Pending</th>
                <th className="px-3 py-2 font-semibold">Oldest pending</th>
              </tr>
            </thead>
            <tbody>
              {byDistrict.map(([key, v]) => (
                <tr key={key} className="border-t border-border bg-card">
                  <td className="px-3 py-2 font-semibold text-primary">{key}</td>
                  <td className="px-3 py-2">{v.total}</td>
                  <td className="px-3 py-2">{v.pending}</td>
                  <td className="px-3 py-2">{v.pending ? `${v.oldest} days` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-primary">
          <Wallet className="h-5 w-5" aria-hidden="true" /> Victim Compensation DBT pipeline
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["Verified", "Sanctioned", "Sent to Bank (PFMS)", "Credited"].map((name, i) => (
            <div key={name} className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
              <p className="font-serif text-3xl font-bold text-primary">{dbtApps.filter((a) => a.dbt?.stage === i).length}</p>
              <p className="mt-1 text-sm text-muted-foreground">{name}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-base">
          Total sanctioned: <span className="font-bold text-primary">₹{sanctionedTotal.toLocaleString("en-IN")}</span> · Total credited to
          victims' banks: <span className="font-bold text-primary">₹{creditedTotal.toLocaleString("en-IN")}</span> · Undecided
          applications: <span className="font-bold text-primary">{undecided.length}</span>
        </p>
      </section>
    </div>
  );
}

function Dashboard() {
  const { data, hydrated, signOut, resetDemo } = usePortal();
  const navigate = useNavigate();
  const session = data.session;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !session) navigate({ to: "/official" });
  }, [hydrated, session, navigate]);

  const myDistrictApps = useMemo(() => {
    if (!session || session.role === "monitor") return [];
    return data.applications.filter((a) => a.stateCode === session.stateCode && a.district === session.district);
  }, [data.applications, session]);

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Please sign in first…</p>
      </main>
    );
  }

  const districtName = findDistrict(findState(session.stateCode), session.district)?.name ?? "";
  const roleTitle =
    session.role === "clerk" ? "DLSA Front Office Clerk" : session.role === "secretary" ? "DLSA Member Secretary" : "SLSA / NALSA Monitor";

  const clerkQueue = myDistrictApps.filter((a) => a.stage === "clerk");
  const secretaryQueue = myDistrictApps.filter((a) => a.stage === "secretary");
  const decidedMine = myDistrictApps.filter((a) => a.stage === "decided");
  const selected = data.applications.find((a) => a.id === selectedId) ?? null;

  return (
    <main className="page-enter mx-auto w-full max-w-5xl px-4 pb-16">
      <section className="card-enter mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-primary">{roleTitle}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {session.name}
              {districtName ? ` · DLSA ${districtName}` : " · State / National oversight"} · Demonstration — simulated data
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Reset all demo data back to the seeded state?")) resetDemo();
              }}
              className="tactile-button inline-flex items-center gap-2 rounded-lg border-2 border-input bg-background px-4 py-2 text-sm font-semibold text-primary hover:bg-muted"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset demo data
            </button>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate({ to: "/official" });
              }}
              className="tactile-button inline-flex items-center gap-2 rounded-lg border-2 border-input bg-background px-4 py-2 text-sm font-semibold text-primary hover:bg-muted"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6">
        {session.role === "monitor" && <MonitorView />}

        {session.role === "clerk" && (
          <>
            <h2 className="font-serif text-xl font-bold text-primary">District queue — applications to scrutinise ({clerkQueue.length})</h2>
            <div className="mt-3">
              <QueueTable apps={clerkQueue} selectedId={selectedId} onSelect={setSelectedId} emptyText="No applications waiting for scrutiny in your district." />
            </div>
            {selected && selected.stage === "clerk" && clerkQueue.some((a) => a.id === selected.id) && (
              <ClerkPanel key={selected.id} a={selected} officialName={session.name} />
            )}
            {decidedMine.length + secretaryQueue.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                {secretaryQueue.length} file(s) forwarded to the Member Secretary · {decidedMine.length} decided in your district.
              </p>
            )}
          </>
        )}

        {session.role === "secretary" && (
          <div className="space-y-8">
            <section>
              <h2 className="font-serif text-xl font-bold text-primary">Awaiting your decision ({secretaryQueue.length})</h2>
              <div className="mt-3">
                <QueueTable apps={secretaryQueue} selectedId={selectedId} onSelect={setSelectedId} emptyText="No files are waiting for a decision." />
              </div>
              {selected && selected.stage === "secretary" && <SecretaryDecisionPanel key={selected.id} a={selected} />}
            </section>
            <section>
              <h2 className="font-serif text-xl font-bold text-primary">Decided — case & compensation management ({decidedMine.length})</h2>
              <div className="mt-3">
                <QueueTable apps={decidedMine} selectedId={selectedId} onSelect={setSelectedId} emptyText="No decided applications yet." />
              </div>
              {selected && selected.stage === "decided" && selected.decision === "approved" && <SecretaryManagePanel key={selected.id} a={selected} />}
              {selected && selected.stage === "decided" && selected.decision === "rejected" && (
                <div className="mt-3 rounded-lg border border-border bg-background p-4">
                  <AppDetail a={selected} />
                  <p className="mt-3 flex items-center gap-2 font-semibold text-destructive">
                    <XCircle className="h-5 w-5" aria-hidden="true" /> Rejected on {selected.decisionAt ? fmtDate(selected.decisionAt) : ""}. The citizen
                    sees this milestone — and the free alternatives (mediation, Lok Adalat, helpline 15100) — on the tracking screen.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Final eligibility and compensation decisions rest with the Legal Services Authority. This dashboard is a working
        demonstration with simulated data. <Link to="/" className="font-semibold text-primary underline">Back to the citizen portal</Link>
      </p>
    </main>
  );
}

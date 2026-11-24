import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Eye, LogIn, Stamp, UserCheck } from "lucide-react";
import { usePortal, type Role } from "@/lib/portal-store";
import { INDIA_STATES, findDistrict, findState } from "@/data/india";

export const Route = createFileRoute("/official/")({
  head: () => ({
    meta: [
      { title: "Official Login (Demo) — LegalAid India Portal" },
      {
        name: "description",
        content: "Demonstration login for DLSA Front Office Clerks, Member Secretaries and SLSA/NALSA monitors.",
      },
    ],
  }),
  component: OfficialLogin,
});

const selectClass =
  "w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-lg focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const inputClass =
  "w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-lg focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const ROLES: { id: Role; title: string; body: string; icon: typeof Stamp }[] = [
  {
    id: "clerk",
    title: "DLSA Front Office Clerk",
    body: "Receives the district queue, verifies eligibility and documents, forwards files or transfers jurisdiction.",
    icon: Stamp,
  },
  {
    id: "secretary",
    title: "DLSA Member Secretary",
    body: "Approves or rejects, assigns panel advocates, enters the court CNR and manages victim compensation DBT.",
    icon: UserCheck,
  },
  {
    id: "monitor",
    title: "SLSA / NALSA Monitor",
    body: "Read-only state and national oversight — pendency, SLA breaches and DBT pipeline totals.",
    icon: Eye,
  },
];

function OfficialLogin() {
  const { data, signIn, signOut } = usePortal();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("clerk");
  const [name, setName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");

  const state = findState(stateCode);
  const district = findDistrict(state, districtCode);
  const needsDistrict = role !== "monitor";
  const canSignIn = name.trim().length >= 2 && (!needsDistrict || Boolean(state && district));

  const doSignIn = () => {
    if (!canSignIn) return;
    signIn({
      role,
      name: name.trim(),
      stateCode: needsDistrict ? stateCode : "",
      district: needsDistrict ? districtCode : "",
    });
    navigate({ to: "/official/dashboard" });
  };

  return (
    <main className="page-enter mx-auto w-full max-w-3xl px-4 pb-16">
      <section className="card-enter mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-bold text-primary sm:text-3xl">Official Login</h1>
            <p className="mt-1 text-muted-foreground">
              For Legal Services Authority officials only. There is no advocate login on this portal — panel advocates are
              assigned by the Member Secretary and informed by SMS / email.
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-lg border border-accent/60 bg-accent/10 px-4 py-3 text-sm font-semibold text-primary">
          Demonstration — simulated data. Any name works; pick the district whose queue you want to work. Seeded queues exist
          for Sagar, Indore, Bhopal and Jabalpur (Madhya Pradesh) and Central (Delhi).
        </p>

        {data.session ? (
          <div className="mt-6 rounded-lg border border-border bg-background p-4">
            <p className="text-base">
              Signed in as <span className="font-semibold text-primary">{data.session.name}</span> (
              {ROLES.find((r) => r.id === data.session!.role)?.title}
              {data.session.district ? `, ${findDistrict(findState(data.session.stateCode), data.session.district)?.name ?? ""}` : ""}).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/official/dashboard"
                className="tactile-button inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" /> Go to dashboard
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="tactile-button rounded-lg border-2 border-input bg-background px-5 py-3 font-semibold text-primary hover:bg-muted"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  aria-pressed={role === r.id}
                  className={`interactive-card rounded-lg border-2 p-4 text-left ${
                    role === r.id ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <r.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  <span className="mt-2 block font-bold text-primary">{r.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{r.body}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="block">
                <label htmlFor="off-name" className="mb-1 block font-semibold text-primary">
                  Your name *
                </label>
                <input id="off-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. R. K. Sharma" />
              </div>
              {needsDistrict && (
                <>
                  <div className="block">
                    <label htmlFor="off-state" className="mb-1 block font-semibold text-primary">
                      State *
                    </label>
                    <select
                      id="off-state"
                      value={stateCode}
                      onChange={(e) => {
                        setStateCode(e.target.value);
                        setDistrictCode("");
                      }}
                      className={selectClass}
                    >
                      <option value="">Choose an option</option>
                      {INDIA_STATES.map((s) => (
                        <option key={s.code} value={String(s.code)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="block">
                    <label htmlFor="off-district" className="mb-1 block font-semibold text-primary">
                      Your district (DLSA) *
                    </label>
                    <select
                      id="off-district"
                      value={districtCode}
                      disabled={!state}
                      onChange={(e) => setDistrictCode(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Choose an option</option>
                      {(state?.districts ?? []).map((d) => (
                        <option key={d.code} value={String(d.code)}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={doSignIn}
              disabled={!canSignIn}
              className="tactile-button mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-lg font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <LogIn className="h-5 w-5" aria-hidden="true" />
              Sign in (Demo)
            </button>
          </>
        )}
      </section>
    </main>
  );
}

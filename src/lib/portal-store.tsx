import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { generateApplicationNumber, generateDbtRef, rtoCodeFor } from "@/lib/app-number";
import { INDIA_STATES } from "@/data/india";

/**
 * Demo data store for the Free Legal Aid & Victim Compensation Portal.
 *
 * Everything lives in the browser (localStorage, key "legalaid-portal-v1")
 * and is seeded on first run with realistic demonstration data. There is no
 * server: the citizen side and the three official roles all read and write
 * this one store, which is what makes the full loop demo-able end to end.
 */

export type AppKind = "LA" | "VC";
export type Stage = "clerk" | "secretary" | "decided";
export type Role = "clerk" | "secretary" | "monitor";

export type DbtInfo = {
  ref: string;
  /** Sanctioned amount in ₹, set when the Member Secretary sanctions (stage >= 1). */
  amount?: number;
  /** 0 Verified, 1 Sanctioned, 2 Sent to Bank (PFMS), 3 Credited */
  stage: 0 | 1 | 2 | 3;
  stageDates: (string | null)[];
};

export type Application = {
  /** The unique application number, e.g. MP15-LA-241126-0042-5 */
  id: string;
  kind: AppKind;
  applicantName: string;
  fatherName: string;
  gender: "" | "female" | "male" | "other";
  dob: string;
  address: string;
  phone: string;
  categories: string[];
  incomeUnderCap: boolean | null;
  incomeUncertain: boolean;
  /** LA: dispute id from DISPUTES. VC: incident type id. */
  dispute: string;
  oppositeParty: string;
  relief: "" | "file-case" | "advice";
  /** VC only */
  firNumber?: string;
  policeStation?: string;
  incidentType?: string;
  /** Dispute location — the routing district (NOT the Aadhaar address). */
  stateCode: string;
  stateName: string;
  district: string;
  districtName: string;
  rtoCode: string;
  submittedAt: string;
  stage: Stage;
  scrutiny?: { by: string; at: string; note: string };
  decision?: "approved" | "rejected";
  decisionAt?: string;
  advocate?: { name: string; phone: string };
  dispatchNote?: string;
  cnr?: string;
  reportingSlip?: { date: string; courtAddress: string };
  transfers: { fromDistrict: string; toDistrict: string; at: string; by: string }[];
  dbt?: DbtInfo;
};

export type Session = { role: Role; name: string; stateCode: string; district: string } | null;

type StoreData = {
  applications: Application[];
  /** Per-RTO counters: last used sequence per district stamp + kind. */
  counters: Record<string, number>;
  dbtSeq: number;
  session: Session;
};

export type NewApplicationInput = Omit<
  Application,
  "id" | "submittedAt" | "stage" | "transfers" | "stateName" | "districtName" | "rtoCode" | "dbt"
> & { stateName?: string };

const STORAGE_KEY = "legalaid-portal-v1";

/** Panel advocates empanelled with each DLSA (fictional, for the demo). */
export const PANEL_ADVOCATES: Record<string, { name: string; phone: string }[]> = {
  Sagar: [
    { name: "Adv. Rakesh Kumar Jain", phone: "98260 41023" },
    { name: "Adv. Sunita Chourasia", phone: "94251 78314" },
    { name: "Adv. Mohd. Salim Khan", phone: "98930 25647" },
    { name: "Adv. Priya Vishwakarma", phone: "97520 61893" },
  ],
  Indore: [
    { name: "Adv. Deepak Sharma", phone: "98267 30415" },
    { name: "Adv. Kavita Malviya", phone: "94250 92738" },
    { name: "Adv. Arjun Singh Chauhan", phone: "98931 47562" },
  ],
  Bhopal: [
    { name: "Adv. Farhan Qureshi", phone: "98260 58147" },
    { name: "Adv. Meena Ahirwar", phone: "94256 20384" },
  ],
  Jabalpur: [
    { name: "Adv. Sanjay Patel", phone: "94251 63927" },
    { name: "Adv. Ritu Kesharwani", phone: "98935 71480" },
  ],
  Central: [{ name: "Adv. Ananya Bhatnagar", phone: "98110 42365" }],
};

export function advocatesFor(districtName: string): { name: string; phone: string }[] {
  return PANEL_ADVOCATES[districtName] ?? [];
}

function daysAgo(days: number, hours = 0): string {
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
}

function districtOf(stateName: string, districtName: string): { stateCode: string; districtCode: string; index: number } {
  const state = INDIA_STATES.find((s) => s.name === stateName);
  const idx = state?.districts.findIndex((d) => d.name === districtName) ?? -1;
  return {
    stateCode: state ? String(state.code) : "",
    districtCode: idx >= 0 ? String(state!.districts[idx]!.code) : "",
    index: Math.max(idx, 0),
  };
}

function seedApplications(): Application[] {
  const mk = (
    stateName: string,
    districtName: string,
    kind: AppKind,
    counter: number,
    submittedAt: string,
    rest: Partial<Application> & { applicantName: string },
  ): Application => {
    const { stateCode, districtCode, index } = districtOf(stateName, districtName);
    const rto = rtoCodeFor(stateName, districtName, index);
    const id = generateApplicationNumber(rto, kind, new Date(submittedAt), counter);
    return {
      id,
      kind,
      fatherName: "",
      gender: "",
      dob: "",
      address: "",
      phone: "",
      categories: [],
      incomeUnderCap: null,
      incomeUncertain: false,
      dispute: "",
      oppositeParty: "",
      relief: "file-case",
      stateCode,
      stateName,
      district: districtCode,
      districtName,
      rtoCode: rto,
      submittedAt,
      stage: "clerk",
      transfers: [],
      ...rest,
    };
  };

  const apps: Application[] = [
    // 1 — Fresh LA claim sitting with the Sagar Front Office Clerk.
    mk("Madhya Pradesh", "Sagar", "LA", 41, daysAgo(0, 5), {
      applicantName: "Kamla Bai Ahirwar",
      fatherName: "Late Shri Bhagwan Das",
      gender: "female",
      dob: "12/04/1985",
      address: "Ward No. 12, Near Bus Stand, Banda Road, Sagar, Madhya Pradesh 470002",
      phone: "98265 30714",
      categories: ["woman", "scst"],
      dispute: "family",
      oppositeParty: "Ramesh Ahirwar",
      relief: "file-case",
    }),
    // 2 — LA claim with the Indore Member Secretary (clerk scrutiny done).
    mk("Madhya Pradesh", "Indore", "LA", 128, daysAgo(2, 3), {
      applicantName: "Mohammed Irfan Sheikh",
      fatherName: "Abdul Sheikh",
      gender: "male",
      dob: "03/09/1990",
      address: "14, Khajrana Main Road, Indore, Madhya Pradesh 452016",
      phone: "98934 62081",
      categories: [],
      incomeUnderCap: true,
      dispute: "labour",
      oppositeParty: "Shree Textiles Pvt. Ltd.",
      relief: "file-case",
      stage: "secretary",
      scrutiny: { by: "Front Office Clerk, DLSA Indore", at: daysAgo(1, 6), note: "ID and income declaration verified. Documents complete." },
    }),
    // 3 — Approved in Bhopal, panel advocate assigned, awaiting CNR.
    mk("Madhya Pradesh", "Bhopal", "LA", 87, daysAgo(4, 2), {
      applicantName: "Rekha Vishwakarma",
      fatherName: "Suresh Vishwakarma",
      gender: "female",
      dob: "27/01/1993",
      address: "H-42, Arera Colony, Bhopal, Madhya Pradesh 462016",
      phone: "94250 81637",
      categories: ["woman"],
      dispute: "civil",
      oppositeParty: "Anil Gupta",
      relief: "file-case",
      stage: "decided",
      scrutiny: { by: "Front Office Clerk, DLSA Bhopal", at: daysAgo(3, 5), note: "Category proof (woman) — no income test required. Verified." },
      decision: "approved",
      decisionAt: daysAgo(3, 1),
      advocate: { name: "Adv. Farhan Qureshi", phone: "98260 58147" },
      dispatchNote: "Assignment dispatched to the advocate by SMS and email with the case PDF.",
    }),
    // 4 — Court-registered in Jabalpur with CNR and reporting slip (portal scope ends here).
    mk("Madhya Pradesh", "Jabalpur", "LA", 59, daysAgo(8, 4), {
      applicantName: "Dinesh Kumar Kol",
      fatherName: "Ram Prasad Kol",
      gender: "male",
      dob: "15/06/1988",
      address: "Village Khamaria, Jabalpur, Madhya Pradesh 482005",
      phone: "97531 20468",
      categories: ["scst"],
      dispute: "revenue",
      oppositeParty: "State of Madhya Pradesh (Tehsildar, Khamaria)",
      relief: "file-case",
      stage: "decided",
      scrutiny: { by: "Front Office Clerk, DLSA Jabalpur", at: daysAgo(7, 2), note: "Caste certificate and revenue records verified." },
      decision: "approved",
      decisionAt: daysAgo(6, 3),
      advocate: { name: "Adv. Sanjay Patel", phone: "94251 63927" },
      dispatchNote: "Assignment dispatched to the advocate by SMS and email with the case PDF.",
      cnr: "MPJC040012342026",
      reportingSlip: { date: daysAgo(-3).slice(0, 10), courtAddress: "District & Sessions Court, Jabalpur, Madhya Pradesh" },
    }),
    // 5 — Rejected in Sagar (income above the state limit, no Section 12 category).
    mk("Madhya Pradesh", "Sagar", "LA", 36, daysAgo(5, 7), {
      applicantName: "Vikram Singh Rajput",
      fatherName: "Narayan Singh Rajput",
      gender: "male",
      dob: "09/11/1982",
      address: "Civil Lines, Sagar, Madhya Pradesh 470001",
      phone: "94254 90312",
      categories: [],
      incomeUnderCap: false,
      dispute: "civil",
      oppositeParty: "HDFC Ergo Insurance Co.",
      relief: "advice",
      stage: "decided",
      scrutiny: { by: "Front Office Clerk, DLSA Sagar", at: daysAgo(4, 4), note: "Income declaration scrutinised; no Section 12 category applies." },
      decision: "rejected",
      decisionAt: daysAgo(4, 1),
    }),
    // 6 — SLA breach: pending with the Sagar clerk for 9 days, untouched.
    mk("Madhya Pradesh", "Sagar", "LA", 33, daysAgo(9, 6), {
      applicantName: "Phoolwati Yadav",
      fatherName: "Late Shri Genda Lal Yadav",
      gender: "female",
      dob: "30/03/1979",
      address: "Gram Panchayat Road, Rahatgarh, Sagar, Madhya Pradesh 470119",
      phone: "98936 54120",
      categories: ["woman"],
      dispute: "criminal",
      oppositeParty: "Unknown",
      relief: "file-case",
    }),
    // 7 — VC claim, DBT Sanctioned (stage 1), Indore.
    mk("Madhya Pradesh", "Indore", "VC", 19, daysAgo(6, 5), {
      applicantName: "Sunita Verma",
      fatherName: "Ramesh Verma",
      gender: "female",
      dob: "19/08/1996",
      address: "77, Vijay Nagar, Indore, Madhya Pradesh 452010",
      phone: "94259 30847",
      categories: ["woman"],
      dispute: "sexual-assault",
      incidentType: "sexual-assault",
      firNumber: "FIR 0421/2026, PS Vijay Nagar",
      policeStation: "Vijay Nagar, Indore",
      relief: "",
      stage: "decided",
      scrutiny: { by: "Front Office Clerk, DLSA Indore", at: daysAgo(5, 3), note: "FIR copy and MLC verified." },
      decision: "approved",
      decisionAt: daysAgo(4, 2),
      dbt: {
        ref: "DLSA-VC-2026-00891",
        amount: 400000,
        stage: 1,
        stageDates: [daysAgo(6, 5), daysAgo(4, 2), null, null],
      },
    }),
    // 8 — VC claim, DBT Sent to Bank / PFMS (stage 2), Bhopal.
    mk("Madhya Pradesh", "Bhopal", "VC", 12, daysAgo(11, 3), {
      applicantName: "Anjali Sharma",
      fatherName: "Prakash Sharma",
      gender: "female",
      dob: "05/12/2000",
      address: "B-9, Kolar Road, Bhopal, Madhya Pradesh 462042",
      phone: "98930 67215",
      categories: ["woman"],
      dispute: "acid-attack",
      incidentType: "acid-attack",
      firNumber: "FIR 0187/2026, PS Kolar",
      policeStation: "Kolar, Bhopal",
      relief: "",
      stage: "decided",
      scrutiny: { by: "Front Office Clerk, DLSA Bhopal", at: daysAgo(10, 2), note: "FIR, MLC and treatment records verified." },
      decision: "approved",
      decisionAt: daysAgo(9, 4),
      dbt: {
        ref: "DLSA-VC-2026-00654",
        amount: 500000,
        stage: 2,
        stageDates: [daysAgo(11, 3), daysAgo(9, 4), daysAgo(2, 5), null],
      },
    }),
    // 9 — VC claim, DBT Credited (stage 3), Delhi (Central).
    mk("Delhi", "Central", "VC", 7, daysAgo(16, 2), {
      applicantName: "Pooja Kumari",
      fatherName: "Surendra Kumar",
      gender: "female",
      dob: "22/02/1998",
      address: "WZ-118, Uttam Nagar, New Delhi 110059",
      phone: "98110 35628",
      categories: ["woman"],
      dispute: "other-crime",
      incidentType: "other-crime",
      firNumber: "FIR 0932/2026, PS Uttam Nagar",
      policeStation: "Uttam Nagar, Delhi",
      relief: "",
      stage: "decided",
      scrutiny: { by: "Front Office Clerk, DLSA Central (Delhi)", at: daysAgo(15, 1), note: "FIR and medical records verified." },
      decision: "approved",
      decisionAt: daysAgo(14, 3),
      dbt: {
        ref: "DLSA-VC-2026-00317",
        amount: 300000,
        stage: 3,
        stageDates: [daysAgo(16, 2), daysAgo(14, 3), daysAgo(9, 6), daysAgo(6, 4)],
      },
    }),
  ];

  return apps;
}

function seedData(): StoreData {
  const applications = seedApplications();
  const counters: Record<string, number> = {};
  for (const a of applications) {
    const key = `${a.rtoCode}|${a.kind}`;
    const n = Number(a.id.split("-")[3] ?? 0);
    counters[key] = Math.max(counters[key] ?? 0, n);
  }
  return { applications, counters, dbtSeq: 891, session: null };
}

type Ctx = {
  data: StoreData;
  hydrated: boolean;
  submitApplication: (input: NewApplicationInput) => Application;
  clerkForward: (id: string, by: string, note: string) => void;
  clerkTransfer: (id: string, toStateCode: string, toDistrictCode: string, by: string) => void;
  secretaryDecide: (id: string, decision: "approved" | "rejected", dbtAmount?: number) => void;
  assignAdvocate: (id: string, advocate: { name: string; phone: string }) => void;
  enterCNR: (id: string, cnr: string) => void;
  issueSlip: (id: string, date: string) => void;
  dbtAdvance: (id: string) => void;
  signIn: (session: NonNullable<Session>) => void;
  signOut: () => void;
  resetDemo: () => void;
};

const PortalContext = createContext<Ctx | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreData>(() => seedData());
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreData;
        if (parsed && Array.isArray(parsed.applications)) setData(parsed);
      }
    } catch {
      /* keep the seed */
    }
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full/blocked — demo continues in memory */
    }
  }, [data]);

  const patch = useCallback((id: string, fn: (a: Application) => Application) => {
    setData((prev) => ({ ...prev, applications: prev.applications.map((a) => (a.id === id ? fn(a) : a)) }));
  }, []);

  // Mirror of the latest data so submitApplication can compute the next
  // counter / DBT sequence and return the created record synchronously.
  const dataRef = useRef(data);
  dataRef.current = data;

  const submitApplication = useCallback((input: NewApplicationInput): Application => {
    const prev = dataRef.current;
    const state = INDIA_STATES.find((s) => String(s.code) === input.stateCode);
    const districtObj = state?.districts.find((d) => String(d.code) === input.district);
    const stateName = input.stateName ?? state?.name ?? "";
    const districtName = districtObj?.name ?? "";
    const index = state ? state.districts.findIndex((d) => String(d.code) === input.district) : 0;
    const rto = rtoCodeFor(stateName, districtName, Math.max(index, 0));
    const now = new Date();
    const key = `${rto}|${input.kind}`;
    const counter = (prev.counters[key] ?? 0) + 1;
    const dbtSeq = input.kind === "VC" ? prev.dbtSeq + 1 : prev.dbtSeq;
    const created: Application = {
      ...input,
      id: generateApplicationNumber(rto, input.kind, now, counter),
      stateName,
      districtName,
      rtoCode: rto,
      submittedAt: now.toISOString(),
      stage: "clerk",
      transfers: [],
      ...(input.kind === "VC"
        ? { dbt: { ref: generateDbtRef(now, dbtSeq), stage: 0 as const, stageDates: [now.toISOString(), null, null, null] } }
        : {}),
    };
    const next: StoreData = {
      ...prev,
      applications: [created, ...prev.applications],
      counters: { ...prev.counters, [key]: counter },
      dbtSeq,
    };
    dataRef.current = next;
    setData(next);
    return created;
  }, []);

  const clerkForward = useCallback(
    (id: string, by: string, note: string) => {
      patch(id, (a) => ({ ...a, stage: "secretary", scrutiny: { by, at: new Date().toISOString(), note } }));
    },
    [patch],
  );

  const clerkTransfer = useCallback(
    (id: string, toStateCode: string, toDistrictCode: string, by: string) => {
      const state = INDIA_STATES.find((s) => String(s.code) === toStateCode);
      const districtObj = state?.districts.find((d) => String(d.code) === toDistrictCode);
      if (!state || !districtObj) return;
      const index = state.districts.findIndex((d) => String(d.code) === toDistrictCode);
      patch(id, (a) => {
        const { scrutiny: _cleared, ...rest } = a;
        return {
          ...rest,
          stateCode: toStateCode,
          stateName: state.name,
          district: toDistrictCode,
          districtName: districtObj.name,
          stage: "clerk",
          transfers: [...a.transfers, { fromDistrict: a.districtName, toDistrict: districtObj.name, at: new Date().toISOString(), by }],
        };
      });
    },
    [patch],
  );

  const secretaryDecide = useCallback(
    (id: string, decision: "approved" | "rejected", dbtAmount?: number) => {
      patch(id, (a) => ({
        ...a,
        stage: "decided",
        decision,
        decisionAt: new Date().toISOString(),
        ...(a.kind === "VC" && a.dbt
          ? {
              dbt:
                decision === "approved" && a.dbt.stage === 0
                  ? {
                      ...a.dbt,
                      stage: 1 as const,
                      ...(dbtAmount != null ? { amount: dbtAmount } : {}),
                      stageDates: a.dbt.stageDates.map((d, i) => (i === 1 ? new Date().toISOString() : d)),
                    }
                  : a.dbt,
            }
          : {}),
      }));
    },
    [patch],
  );

  const assignAdvocate = useCallback(
    (id: string, advocate: { name: string; phone: string }) => {
      patch(id, (a) => ({
        ...a,
        advocate,
        dispatchNote: "Assignment dispatched to the advocate by SMS and email with the case PDF. (Simulated in this demo.)",
      }));
    },
    [patch],
  );

  const enterCNR = useCallback(
    (id: string, cnr: string) => {
      patch(id, (a) => ({ ...a, cnr: cnr.trim().toUpperCase() }));
    },
    [patch],
  );

  const issueSlip = useCallback(
    (id: string, date: string) => {
      patch(id, (a) => ({
        ...a,
        reportingSlip: { date, courtAddress: `District & Sessions Court, ${a.districtName}, ${a.stateName}` },
      }));
    },
    [patch],
  );

  const dbtAdvance = useCallback(
    (id: string) => {
      patch(id, (a) => {
        if (!a.dbt || a.dbt.stage >= 3) return a;
        const next = (a.dbt.stage + 1) as 0 | 1 | 2 | 3;
        const stageDates = a.dbt.stageDates.map((d, i) => (i === next ? new Date().toISOString() : d));
        return { ...a, dbt: { ...a.dbt, stage: next, stageDates } };
      });
    },
    [patch],
  );

  const signIn = useCallback((session: NonNullable<Session>) => {
    setData((prev) => ({ ...prev, session }));
  }, []);

  const signOut = useCallback(() => {
    setData((prev) => ({ ...prev, session: null }));
  }, []);

  const resetDemo = useCallback(() => {
    const fresh = seedData();
    setData(fresh);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      data,
      hydrated,
      submitApplication,
      clerkForward,
      clerkTransfer,
      secretaryDecide,
      assignAdvocate,
      enterCNR,
      issueSlip,
      dbtAdvance,
      signIn,
      signOut,
      resetDemo,
    }),
    [data, hydrated, submitApplication, clerkForward, clerkTransfer, secretaryDecide, assignAdvocate, enterCNR, issueSlip, dbtAdvance, signIn, signOut, resetDemo],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside PortalProvider");
  return ctx;
}

/** Age in whole days of an application, for SLA checks. */
export function ageDays(a: Application): number {
  return Math.floor((Date.now() - new Date(a.submittedAt).getTime()) / 86400000);
}

/** SLA breach: undecided for more than 7 days. */
export function isSlaBreach(a: Application): boolean {
  return a.stage !== "decided" && ageDays(a) > 7;
}

/** Current status milestone index for the citizen tracking timeline (LA). */
export function statusLabel(a: Application): string {
  if (a.decision === "rejected") return "Rejected";
  if (a.cnr) return "Court Registered — handed off to eCourts";
  if (a.advocate) return "Advocate Assigned";
  if (a.decision === "approved") return "Approved";
  if (a.stage === "secretary") return "With Member Secretary";
  if (a.stage === "clerk") return "Under Scrutiny (Front Office Clerk)";
  return "Submitted";
}

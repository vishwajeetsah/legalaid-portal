import { useMemo, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  HandHeart,
  Loader2,
  PenLine,
  Phone,
  Scale,
  Search,
  Wallet,
} from "lucide-react";
import { SpeakButton } from "@/components/SpeakButton";
import { useLang } from "@/lib/i18n";
import { scanAadhaarImage, type AadhaarScan } from "@/lib/aadhaar-ocr";
import { evaluate, type Answers } from "@/lib/eligibility";
import { usePortal, type Application } from "@/lib/portal-store";
import { DISPUTES, RULES } from "@/data/legalAid";
import { INDIA_STATES, findDistrict, findState } from "@/data/india";

type Kind = "LA" | "VC";
type StepKey = "type" | "scan" | "confirm" | "category" | "income" | "matter" | "incident" | "location" | "sorry" | "done";

const selectClass =
  "interactive-card w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-lg focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const inputClass =
  "interactive-card w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-lg focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const INCIDENTS = [
  { id: "sexual-assault", key: "incidentSexualAssault" },
  { id: "acid-attack", key: "incidentAcidAttack" },
  { id: "other-crime", key: "incidentOtherCrime" },
] as const;

type Draft = {
  kind: Kind | "";
  scanUsed: boolean;
  applicantName: string;
  fatherName: string;
  gender: "" | "female" | "male" | "other";
  dob: string;
  address: string;
  phone: string;
  categories: string[];
  incomeUnderCap: boolean | null;
  incomeUncertain: boolean;
  dispute: string;
  relief: "" | "file-case" | "advice";
  oppositeParty: string;
  oppositeUnknown: boolean;
  incidentType: string;
  firNumber: string;
  policeStation: string;
  disputeStateCode: string;
  disputeDistrictCode: string;
};

const emptyDraft: Draft = {
  kind: "",
  scanUsed: false,
  applicantName: "",
  fatherName: "",
  gender: "",
  dob: "",
  address: "",
  phone: "",
  categories: [],
  incomeUnderCap: null,
  incomeUncertain: false,
  dispute: "",
  relief: "",
  oppositeParty: "",
  oppositeUnknown: false,
  incidentType: "",
  firNumber: "",
  policeStation: "",
  disputeStateCode: "",
  disputeDistrictCode: "",
};

export function ClaimWizard({ onGoTrack, onGoDbt }: { onGoTrack: () => void; onGoDbt: () => void }) {
  const { t, b } = useLang();
  const { submitApplication } = usePortal();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<AadhaarScan | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showIncomeHelper, setShowIncomeHelper] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [created, setCreated] = useState<Application | null>(null);

  const up = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const hasCategory = draft.categories.length > 0;
  const provisionallyEligible = hasCategory || draft.incomeUnderCap === true || draft.incomeUncertain;

  const steps: StepKey[] = useMemo(() => {
    const list: StepKey[] = ["type", "scan", "confirm"];
    if (draft.kind === "VC") {
      list.push("incident", "location");
    } else if (draft.kind === "LA") {
      list.push("category");
      if (!hasCategory) list.push("income");
      list.push(provisionallyEligible ? "matter" : "sorry");
      if (provisionallyEligible) list.push("location");
    }
    return list;
  }, [draft.kind, hasCategory, provisionallyEligible]);

  const currentKey: StepKey = created ? "done" : steps[Math.min(step, steps.length - 1)]!;

  const phoneValid = /^[6-9]\d{9}$/.test(draft.phone.replace(/[\s-]/g, ""));
  const disputeState = findState(draft.disputeStateCode);
  const disputeDistrict = findDistrict(disputeState, draft.disputeDistrictCode);

  const monthly = Number(monthlyIncome.replace(/[^\d]/g, ""));
  const annualEstimate = monthly > 0 ? monthly * 12 : 0;

  const handleScanFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || scanning) return;
    setScanning(true);
    const found = await scanAadhaarImage(file);
    const patch: Partial<Draft> = { scanUsed: true };
    if (found.applicantName) patch.applicantName = found.applicantName;
    if (found.fatherName) patch.fatherName = found.fatherName;
    if (found.address) patch.address = found.address;
    if (found.gender) patch.gender = found.gender;
    if (found.dob) patch.dob = found.dob;
    up(patch);
    setScanResult(found);
    setScanning(false);
  };

  const scanSummary: { label: string; value: string }[] = [];
  if (scanResult) {
    if (scanResult.applicantName) scanSummary.push({ label: t("nameLabel"), value: scanResult.applicantName });
    if (scanResult.fatherName) scanSummary.push({ label: t("fatherLabel"), value: scanResult.fatherName });
    if (scanResult.gender)
      scanSummary.push({
        label: t("genderLabel"),
        value: scanResult.gender === "female" ? t("genderFemale") : scanResult.gender === "male" ? t("genderMale") : t("genderOther"),
      });
    if (scanResult.dob) scanSummary.push({ label: t("dobLabel"), value: scanResult.dob });
    if (scanResult.address) scanSummary.push({ label: t("addressLabel"), value: scanResult.address });
  }

  const toggleCategory = (id: string) => {
    const next = draft.categories.includes(id) ? draft.categories.filter((c) => c !== id) : [...draft.categories, id];
    up({ categories: next, incomeUnderCap: next.length > 0 ? null : draft.incomeUnderCap });
  };

  const setIncome = (value: boolean) => up({ incomeUnderCap: value, incomeUncertain: false });

  const canContinue =
    currentKey === "type"
      ? draft.kind !== ""
      : currentKey === "scan"
        ? true
        : currentKey === "confirm"
          ? Boolean(draft.applicantName.trim() && draft.fatherName.trim() && draft.address.trim() && phoneValid)
          : currentKey === "category"
            ? true
            : currentKey === "income"
              ? draft.incomeUnderCap !== null || draft.incomeUncertain
              : currentKey === "matter"
                ? Boolean(draft.dispute) && draft.relief !== ""
                : currentKey === "incident"
                  ? draft.incidentType !== ""
                  : currentKey === "location"
                    ? Boolean(draft.disputeStateCode && draft.disputeDistrictCode)
                    : true;

  const doSubmit = () => {
    const app = submitApplication({
      kind: draft.kind as Kind,
      applicantName: draft.applicantName.trim(),
      fatherName: draft.fatherName.trim(),
      gender: draft.gender,
      dob: draft.dob,
      address: draft.address.trim(),
      phone: draft.phone.trim(),
      categories: draft.kind === "LA" ? draft.categories : draft.gender === "female" ? ["woman"] : [],
      incomeUnderCap: draft.kind === "LA" ? draft.incomeUnderCap : null,
      incomeUncertain: draft.kind === "LA" ? draft.incomeUncertain : false,
      dispute: draft.kind === "LA" ? draft.dispute : draft.incidentType,
      oppositeParty: draft.oppositeUnknown ? "" : draft.oppositeParty.trim(),
      relief: draft.kind === "LA" ? draft.relief : "",
      ...(draft.kind === "VC"
        ? {
            incidentType: draft.incidentType,
            ...(draft.firNumber.trim() ? { firNumber: draft.firNumber.trim() } : {}),
            ...(draft.policeStation.trim() ? { policeStation: draft.policeStation.trim() } : {}),
          }
        : {}),
      stateCode: draft.disputeStateCode,
      district: draft.disputeDistrictCode,
    });
    setCreated(app);
  };

  const goNext = () => {
    if (currentKey === "location") {
      doSubmit();
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const restart = () => {
    setDraft(emptyDraft);
    setCreated(null);
    setStep(0);
    setScanResult(null);
    setEditMode(false);
    setShowIncomeHelper(false);
    setMonthlyIncome("");
  };

  const optionButtonClass = (selected: boolean) =>
    `interactive-card w-full rounded-lg border-2 px-4 py-4 text-left text-lg ${
      selected ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border bg-background hover:border-primary/40"
    }`;

  const genderText =
    draft.gender === "female" ? t("genderFemale") : draft.gender === "male" ? t("genderMale") : draft.gender === "other" ? t("genderOther") : "";

  const verdict = useMemo(() => {
    const answers: Answers = {
      stateCode: draft.disputeStateCode,
      district: draft.disputeDistrictCode,
      taluk: "",
      categories: draft.categories,
      incomeUnderCap: draft.incomeUnderCap,
      dispute: draft.dispute,
      applicantName: draft.applicantName,
      fatherName: draft.fatherName,
      address: draft.address,
      phone: draft.phone,
      gender: draft.gender,
      dob: draft.dob,
      oppositeParty: draft.oppositeParty,
      oppositeUnknown: draft.oppositeUnknown,
      relief: draft.relief,
      previousApplication: false,
      casePending: false,
      incomeUncertain: draft.incomeUncertain,
      scanUsed: draft.scanUsed,
      pin: "",
    };
    return evaluate(answers);
  }, [draft]);

  return (
    <div key={currentKey} className="card-enter rounded-lg border border-border bg-card p-6 shadow-sm">
      {currentKey !== "done" && (
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {step + 1} / {steps.length}
        </p>
      )}

      {currentKey === "type" && (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("claimTypeTitle")}</h2>
            <SpeakButton text={t("claimTypeTitle")} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => up({ kind: "LA" })}
              aria-pressed={draft.kind === "LA"}
              className={`interactive-card rounded-lg border-2 p-5 text-left ${draft.kind === "LA" ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}
            >
              <Scale className="h-8 w-8 text-primary" aria-hidden="true" />
              <span className="mt-3 block text-xl font-bold text-primary">{t("claimTypeLA")}</span>
              <span className="mt-1 block text-base text-muted-foreground">{t("claimTypeLABody")}</span>
            </button>
            <button
              type="button"
              onClick={() => up({ kind: "VC" })}
              aria-pressed={draft.kind === "VC"}
              className={`interactive-card rounded-lg border-2 p-5 text-left ${draft.kind === "VC" ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}
            >
              <HandHeart className="h-8 w-8 text-primary" aria-hidden="true" />
              <span className="mt-3 block text-xl font-bold text-primary">{t("claimTypeVC")}</span>
              <span className="mt-1 block text-base text-muted-foreground">{t("claimTypeVCBody")}</span>
            </button>
          </div>
        </>
      )}

      {currentKey === "scan" && (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("scanTitle")}</h2>
            <SpeakButton text={`${t("scanTitle")} ${t("scanBody")}`} />
          </div>
          <p className="mt-2 text-muted-foreground">{t("scanBody")}</p>

          <label
            className={`tactile-button mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 text-lg font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground ${
              scanning ? "cursor-wait opacity-70" : "cursor-pointer"
            }`}
          >
            {scanning ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Camera className="h-5 w-5" aria-hidden="true" />}
            {scanning ? t("scanReading") : t("scanButton")}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={scanning} onChange={handleScanFile} />
          </label>

          {scanResult !== null &&
            (scanSummary.length > 0 ? (
              <div className="mt-5 rounded-lg border border-success/50 bg-success/10 p-4">
                <p className="flex items-center gap-2 font-semibold text-primary">
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                  {t("scanReadTitle")}
                </p>
                <dl className="mt-3 space-y-2">
                  {scanSummary.map((row) => (
                    <div key={row.label} className="flex flex-wrap gap-x-2 text-base">
                      <dt className="font-semibold text-primary">{row.label}:</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="mt-5 rounded-lg border border-border bg-background px-4 py-3 text-base text-muted-foreground">{t("scanNoneFound")}</p>
            ))}

          <button
            type="button"
            onClick={goNext}
            className="tactile-button mt-4 inline-flex items-center gap-2 rounded-lg border-2 border-input bg-background px-5 py-3 font-semibold text-primary hover:bg-muted"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            {t("scanTypeInstead")}
          </button>
        </>
      )}

      {currentKey === "confirm" && (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("confirmTitle")}</h2>
            <SpeakButton text={`${t("confirmTitle")} ${draft.scanUsed ? t("confirmHelpScan") : t("confirmHelp")}`} />
          </div>
          <p className="mt-2 text-muted-foreground">{draft.scanUsed ? t("confirmHelpScan") : t("confirmHelp")}</p>

          {draft.scanUsed && !editMode ? (
            <>
              <dl className="mt-5 space-y-3 rounded-lg border border-border bg-background p-4">
                {[
                  { label: t("nameLabel"), value: draft.applicantName },
                  { label: t("fatherLabel"), value: draft.fatherName },
                  { label: t("genderLabel"), value: genderText },
                  { label: t("dobLabel"), value: draft.dob },
                  { label: t("addressLabel"), value: draft.address },
                ].map((row) => (
                  <div key={row.label} className="flex flex-wrap gap-x-2 text-lg">
                    <dt className="font-semibold text-primary">{row.label}:</dt>
                    <dd>{row.value || "—"}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                <TextField
                  label={t("phoneLabel")}
                  value={draft.phone}
                  onChange={(v) => up({ phone: v })}
                  inputMode="tel"
                  error={draft.phone.trim() && !phoneValid ? t("phoneInvalid") : ""}
                />
              </div>
              <button type="button" onClick={() => setEditMode(true)} className="mt-4 text-sm font-semibold text-muted-foreground underline">
                {t("editDetailsLabel")}
              </button>
            </>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextField label={t("nameLabel")} value={draft.applicantName} onChange={(v) => up({ applicantName: v })} />
              <TextField label={t("fatherLabel")} value={draft.fatherName} onChange={(v) => up({ fatherName: v })} />
              <div className="block">
                <label htmlFor="cw-gender" className="mb-1 block font-semibold text-primary">
                  {t("genderLabel")}
                </label>
                <select id="cw-gender" value={draft.gender} onChange={(e) => up({ gender: e.target.value as Draft["gender"] })} className={selectClass}>
                  <option value="">{t("choose")}</option>
                  <option value="female">{t("genderFemale")}</option>
                  <option value="male">{t("genderMale")}</option>
                  <option value="other">{t("genderOther")}</option>
                </select>
              </div>
              <TextField label={t("dobLabel")} value={draft.dob} onChange={(v) => up({ dob: v })} required={false} />
              <div className="block sm:col-span-2">
                <label htmlFor="cw-address" className="mb-1 block font-semibold text-primary">
                  {t("addressLabel")} <span className="text-destructive">*</span>
                </label>
                <textarea id="cw-address" rows={3} value={draft.address} onChange={(e) => up({ address: e.target.value })} className={inputClass} />
              </div>
              <TextField
                label={t("phoneLabel")}
                value={draft.phone}
                onChange={(v) => up({ phone: v })}
                inputMode="tel"
                error={draft.phone.trim() && !phoneValid ? t("phoneInvalid") : ""}
              />
            </div>
          )}
        </>
      )}

      {currentKey === "category" && (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("q1Title")}</h2>
            <SpeakButton text={`${t("q1Title")} ${t("q1Help")}`} />
          </div>
          <p className="mt-2 text-muted-foreground">{t("q1Help")}</p>
          <div className="mt-5 space-y-3">
            {RULES.categories.map((c) => {
              const selected = draft.categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={selected}
                  className={`interactive-card flex w-full items-center gap-3 rounded-lg border-2 px-4 py-4 text-left text-lg ${
                    selected ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    }`}
                    aria-hidden="true"
                  >
                    {selected ? "✓" : ""}
                  </span>
                  {b(c.label)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => up({ categories: [] })}
              aria-pressed={!hasCategory}
              className={`interactive-card flex w-full items-center gap-3 rounded-lg border-2 px-4 py-4 text-left text-lg ${
                !hasCategory ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border bg-background hover:border-primary/40"
              }`}
            >
              {t("noneApply")}
            </button>
          </div>
        </>
      )}

      {currentKey === "income" && (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("q2Title")}</h2>
            <SpeakButton text={`${t("q2Title")} ${t("q2Help")}`} />
          </div>
          <p className="mt-2 text-muted-foreground">{t("q2Help")}</p>
          <div className="mt-5 space-y-3">
            <button type="button" onClick={() => setIncome(true)} aria-pressed={draft.incomeUnderCap === true} className={optionButtonClass(draft.incomeUnderCap === true)}>
              {t("yes")}
            </button>
            <button type="button" onClick={() => setIncome(false)} aria-pressed={draft.incomeUnderCap === false} className={optionButtonClass(draft.incomeUnderCap === false)}>
              {t("no")}
            </button>
            <button
              type="button"
              onClick={() => setShowIncomeHelper((v) => !v)}
              aria-pressed={showIncomeHelper}
              aria-expanded={showIncomeHelper}
              className={optionButtonClass(showIncomeHelper)}
            >
              {t("notSure")}
            </button>
          </div>

          {showIncomeHelper && (
            <div className="mt-5 rounded-lg border border-border bg-background p-4">
              <label htmlFor="cw-monthly-income" className="mb-2 block text-lg font-semibold text-primary">
                {t("monthlyIncomeLabel")}
              </label>
              <input
                id="cw-monthly-income"
                value={monthlyIncome}
                inputMode="numeric"
                onChange={(e) => setMonthlyIncome(e.target.value.replace(/[^\d]/g, ""))}
                className={inputClass}
              />
              {annualEstimate > 0 && (
                <>
                  <p className="mt-4 text-lg">
                    {t("annualEstimateBefore")} <span className="font-bold text-primary">₹{annualEstimate.toLocaleString("en-IN")}</span>{" "}
                    {t("annualEstimateAfter")}
                  </p>
                  <p className="mt-3 font-semibold text-primary">{t("belowLimitQuestion")}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => setIncome(true)} aria-pressed={draft.incomeUnderCap === true} className={optionButtonClass(draft.incomeUnderCap === true)}>
                      {t("yes")}
                    </button>
                    <button type="button" onClick={() => setIncome(false)} aria-pressed={draft.incomeUnderCap === false} className={optionButtonClass(draft.incomeUnderCap === false)}>
                      {t("no")}
                    </button>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => up({ incomeUncertain: true, incomeUnderCap: null })}
                aria-pressed={draft.incomeUncertain}
                className={`mt-4 text-left font-semibold underline ${draft.incomeUncertain ? "text-success" : "text-primary"}`}
              >
                {t("stillDontKnow")}
              </button>
            </div>
          )}
        </>
      )}

      {currentKey === "matter" && (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("matterTitle")}</h2>
            <SpeakButton text={`${t("matterTitle")} ${t("matterHelp")}`} />
          </div>
          <p className="mt-2 text-muted-foreground">{t("matterHelp")}</p>
          <div className="mt-5 space-y-6">
            <div>
              <p className="mb-2 text-lg font-semibold text-primary">{t("q3Title")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {DISPUTES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => up({ dispute: d.id })}
                    aria-pressed={draft.dispute === d.id}
                    className={`interactive-card rounded-lg border-2 px-4 py-4 text-left text-lg ${
                      draft.dispute === d.id ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    {b(d.label)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold text-primary">{t("reliefLabel")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => up({ relief: "file-case" })} aria-pressed={draft.relief === "file-case"} className={optionButtonClass(draft.relief === "file-case")}>
                  {t("reliefFileCase")}
                </button>
                <button type="button" onClick={() => up({ relief: "advice" })} aria-pressed={draft.relief === "advice"} className={optionButtonClass(draft.relief === "advice")}>
                  {t("reliefAdvice")}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="cw-opposite" className="mb-1 block font-semibold text-primary">
                {t("oppositeLabel")}
              </label>
              <input
                id="cw-opposite"
                value={draft.oppositeParty}
                disabled={draft.oppositeUnknown}
                onChange={(e) => up({ oppositeParty: e.target.value })}
                className={`${inputClass} disabled:opacity-50`}
              />
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-base">
                <input
                  type="checkbox"
                  checked={draft.oppositeUnknown}
                  onChange={(e) => up({ oppositeUnknown: e.target.checked })}
                  className="h-5 w-5 accent-[oklch(0.390_0.082_77)]"
                />
                {t("oppositeUnknownLabel")}
              </label>
            </div>
          </div>
        </>
      )}

      {currentKey === "incident" && (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("incidentTitle")}</h2>
            <SpeakButton text={`${t("incidentTitle")} ${t("incidentHelp")}`} />
          </div>
          <p className="mt-2 text-muted-foreground">{t("incidentHelp")}</p>
          <div className="mt-5 space-y-3">
            {INCIDENTS.map((inc) => (
              <button
                key={inc.id}
                type="button"
                onClick={() => up({ incidentType: inc.id })}
                aria-pressed={draft.incidentType === inc.id}
                className={optionButtonClass(draft.incidentType === inc.id)}
              >
                {t(inc.key)}
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <TextField label={t("firLabel")} value={draft.firNumber} onChange={(v) => up({ firNumber: v })} required={false} />
            <TextField label={t("policeStationLabel")} value={draft.policeStation} onChange={(v) => up({ policeStation: v })} required={false} />
          </div>
        </>
      )}

      {currentKey === "location" && (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("disputeLocationTitle")}</h2>
            <SpeakButton text={`${t("disputeLocationTitle")} ${t("disputeLocationHelp")}`} />
          </div>
          <p className="mt-2 text-muted-foreground">{t("disputeLocationHelp")}</p>
          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="cw-dstate" className="mb-2 block text-lg font-semibold text-primary">
                {t("disputeStateLabel")}
              </label>
              <select
                id="cw-dstate"
                value={draft.disputeStateCode}
                onChange={(e) => up({ disputeStateCode: e.target.value, disputeDistrictCode: "" })}
                className={selectClass}
              >
                <option value="">{t("choose")}</option>
                {INDIA_STATES.map((s) => (
                  <option key={s.code} value={String(s.code)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cw-ddistrict" className="mb-2 block text-lg font-semibold text-primary">
                {t("disputeDistrictLabel")}
              </label>
              <select
                id="cw-ddistrict"
                value={draft.disputeDistrictCode}
                disabled={!disputeState}
                onChange={(e) => up({ disputeDistrictCode: e.target.value })}
                className={selectClass}
              >
                <option value="">{t("choose")}</option>
                {(disputeState?.districts ?? []).map((d) => (
                  <option key={d.code} value={String(d.code)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            {disputeState && disputeDistrict && (
              <p className="rounded-lg border border-border bg-background px-4 py-3 text-base">
                {t("routedTo")}:{" "}
                <span className="font-semibold text-primary">
                  {t("dlsaName")}, {disputeDistrict.name} ({disputeState.name})
                </span>
              </p>
            )}
          </div>
        </>
      )}

      {currentKey === "sorry" && (
        <>
          <h2 className="mt-2 font-serif text-2xl font-bold text-primary sm:text-3xl">{t("notEligibleTitle")}</h2>
          <div className="mt-4 rounded-xl bg-background p-4">
            <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t("whyTitle")}</p>
            <ul className="mt-2 space-y-3">
              {verdict.reasons.map((reason, i) => (
                <li key={i} className="text-base">
                  {b(reason)}
                </li>
              ))}
            </ul>
          </div>
          <h3 className="mt-6 font-serif text-xl font-bold text-primary">{t("altTitle")}</h3>
          <ul className="mt-3 space-y-3 text-base">
            <li className="rounded-lg border border-border p-4">
              <p className="font-semibold text-primary">{t("altMediation")}</p>
              <p className="text-muted-foreground">{t("altMediationBody")}</p>
            </li>
            <li className="rounded-lg border border-border p-4">
              <p className="font-semibold text-primary">{t("altLokAdalat")}</p>
              <p className="text-muted-foreground">{t("altLokAdalatBody")}</p>
            </li>
            <li className="rounded-lg border border-border p-4">
              <p className="flex items-center gap-2 font-semibold text-primary">
                <Phone className="h-4 w-4" aria-hidden="true" /> {t("altHelpline")}
              </p>
              <p className="text-muted-foreground">{t("altHelplineBody")}</p>
            </li>
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">{t("disclaimer")}</p>
        </>
      )}

      {currentKey === "done" && created && (
        <>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="animated-check mt-1 h-9 w-9 shrink-0 text-success" aria-hidden="true" />
            <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">{t("applicationGenerated")}</h2>
          </div>
          <div className="mt-6 rounded-lg border-2 border-primary bg-background p-5 text-center">
            <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t("yourAppNumber")}</p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-wide text-primary sm:text-3xl">{created.id}</p>
            <p className="mt-3 text-base text-muted-foreground">{t("appNumberHelp")}</p>
          </div>
          <p className="mt-4 text-lg">
            {t("routedTo")}:{" "}
            <span className="font-semibold text-primary">
              {t("dlsaName")}, {created.districtName} ({created.stateName})
            </span>
          </p>
          {created.dbt && (
            <div className="mt-4 rounded-lg border-2 border-accent bg-accent/10 p-5 text-center">
              <p className="flex items-center justify-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                <Wallet className="h-4 w-4" aria-hidden="true" /> {t("yourDbtRef")}
              </p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-wide text-primary">{created.dbt.ref}</p>
              <p className="mt-3 text-base text-muted-foreground">{t("dbtRefHelp")}</p>
            </div>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={created.kind === "VC" ? onGoDbt : onGoTrack}
              className="tactile-button inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {created.kind === "VC" ? t("tabDbt") : t("tabTrack")}
            </button>
            <button
              type="button"
              onClick={restart}
              className="tactile-button inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primary bg-card px-6 py-4 font-bold text-primary hover:bg-primary/5"
            >
              {t("claimAnother")}
            </button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{t("disclaimer")}</p>
        </>
      )}

      {currentKey !== "done" && currentKey !== "sorry" && (
        <div className="mt-7 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="tactile-button inline-flex items-center gap-2 rounded-lg border-2 border-input bg-background px-5 py-3 font-semibold text-primary hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("back")}
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue}
            className="tactile-button inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {currentKey === "location" ? t("submitClaim") : t("next")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {currentKey === "sorry" && (
        <div className="mt-7">
          <button
            type="button"
            onClick={restart}
            className="tactile-button inline-flex items-center gap-2 rounded-lg border-2 border-input bg-background px-5 py-3 font-semibold text-primary hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("startOver")}
          </button>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  inputMode,
  error = "",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "tel";
  error?: string;
  required?: boolean;
}) {
  const inputId = `cw-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="block">
      <label htmlFor={inputId} className="mb-1 block font-semibold text-primary">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        id={inputId}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`${inputClass} ${error ? "border-destructive" : ""}`}
      />
      {error && <p className="mt-1 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Unique Application Number for the Legal Aid / Victim Compensation portal.
 *
 * Format: <RTO code>-<KIND>-<DDMMYY>-<4-digit counter>-<Luhn check digit>
 *   e.g.  MP09-LA-241126-0042-7   (Legal Aid, Indore)
 *         MP15-VC-101126-0007-3   (Victim Compensation, Sagar)
 *
 * The RTO code stamps the DISPUTE district (the DLSA that will process the
 * application), so the number itself routes the file. The counter is
 * per-district and sequential. The final digit is a standard Luhn (Mod-10)
 * check digit computed over every digit of the payload (RTO digits + kind is
 * letters, skipped + date digits + counter digits), so a mistyped number is
 * rejected instantly — before any lookup.
 */

/** Real RTO codes keyed by "State name|District name" exactly as in the LGD data (src/data/india.ts). */
const RTO_TABLE: Record<string, string> = {
  // ---- Madhya Pradesh (complete for the districts with long-standing RTOs) ----
  "Madhya Pradesh|Bhopal": "MP04",
  "Madhya Pradesh|Hoshangabad": "MP05", // Narmadapuram
  "Madhya Pradesh|Morena": "MP06",
  "Madhya Pradesh|Gwalior": "MP07",
  "Madhya Pradesh|Guna": "MP08",
  "Madhya Pradesh|Indore": "MP09",
  "Madhya Pradesh|Khargone": "MP10",
  "Madhya Pradesh|Dhar": "MP11",
  "Madhya Pradesh|East Nimar": "MP12", // Khandwa
  "Madhya Pradesh|Ujjain": "MP13",
  "Madhya Pradesh|Mandsaur": "MP14",
  "Madhya Pradesh|Sagar": "MP15",
  "Madhya Pradesh|Chhatarpur": "MP16",
  "Madhya Pradesh|Rewa": "MP17",
  "Madhya Pradesh|Shahdol": "MP18",
  "Madhya Pradesh|Satna": "MP19",
  "Madhya Pradesh|Jabalpur": "MP20",
  "Madhya Pradesh|Ratlam": "MP21",
  "Madhya Pradesh|Dewas": "MP22",
  "Madhya Pradesh|Shivpuri": "MP25",
  "Madhya Pradesh|Bhind": "MP26",
  "Madhya Pradesh|Chhindwara": "MP28",
  "Madhya Pradesh|Sheopur": "MP31",
  "Madhya Pradesh|Shajapur": "MP37",
  "Madhya Pradesh|Vidisha": "MP40",
  "Madhya Pradesh|Neemuch": "MP44",
  "Madhya Pradesh|Jhabua": "MP45",
  "Madhya Pradesh|Barwani": "MP46",
  "Madhya Pradesh|Singrauli": "MP48",
  "Madhya Pradesh|Narsinghpur": "MP49",
  "Madhya Pradesh|Balaghat": "MP50",
  "Madhya Pradesh|Mandla": "MP51",
  "Madhya Pradesh|Seoni": "MP52",
  "Madhya Pradesh|Sidhi": "MP53",
  "Madhya Pradesh|Umaria": "MP54",
  // ---- Major metros / capitals of other states ----
  "Delhi|Central": "DL01",
  "Delhi|New Delhi": "DL02",
  "Maharashtra|Pune": "MH12",
  "Maharashtra|Mumbai": "MH02",
  "Karnataka|Bangalore": "KA03",
  "Tamil Nadu|Chennai": "TN09",
  "West Bengal|Kolkata": "WB02",
  "Uttar Pradesh|Gautam Buddha Nagar": "UP16", // Noida
  "Rajasthan|Jaipur": "RJ14",
  "Gujarat|Ahmedabad": "GJ01",
  "Telangana|Hyderabad": "TS09",
  "Kerala|Ernakulam": "KL07", // Kochi
  "Punjab|Amritsar": "PB02",
  "Haryana|Gurugram": "HR26", // Gurgaon
  "Bihar|Patna": "BR01",
  "Chhattisgarh|Raipur": "CG04",
  "Odisha|Khordha": "OD02", // Bhubaneswar
  "Assam|Kamrup Metro": "AS01", // Guwahati
};

/** Two-letter vehicle-series prefix per state, used by the demo fallback below. */
const STATE_PREFIX: Record<string, string> = {
  "Andaman and Nicobar Islands": "AN",
  "Andhra Pradesh": "AP",
  "Arunachal Pradesh": "AR",
  Assam: "AS",
  Bihar: "BR",
  Chandigarh: "CH",
  Chhattisgarh: "CG",
  "Dadra and Nagar Haveli and Daman and Diu": "DD",
  Delhi: "DL",
  Goa: "GA",
  Gujarat: "GJ",
  Haryana: "HR",
  "Himachal Pradesh": "HP",
  "Jammu and Kashmir": "JK",
  Jharkhand: "JH",
  Karnataka: "KA",
  Kerala: "KL",
  Ladakh: "LA",
  Lakshadweep: "LD",
  "Madhya Pradesh": "MP",
  Maharashtra: "MH",
  Manipur: "MN",
  Meghalaya: "ML",
  Mizoram: "MZ",
  Nagaland: "NL",
  Odisha: "OD",
  Puducherry: "PY",
  Punjab: "PB",
  Rajasthan: "RJ",
  Sikkim: "SK",
  "Tamil Nadu": "TN",
  Telangana: "TS",
  Tripura: "TR",
  "Uttar Pradesh": "UP",
  Uttarakhand: "UK",
  "West Bengal": "WB",
};

/**
 * RTO code for a dispute district. Districts without a mapped real RTO use a
 * DEMO fallback: the state's two-letter series prefix + the district's
 * two-digit index within the state list (e.g. MP + 37). This keeps every
 * district routable in the demo; a production build would ship the full
 * official RTO table.
 */
export function rtoCodeFor(stateName: string, districtName: string, districtIndex = 0): string {
  const real = RTO_TABLE[`${stateName}|${districtName}`];
  if (real) return real;
  const prefix = STATE_PREFIX[stateName] ?? stateName.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  return `${prefix}${String(districtIndex + 1).padStart(2, "0")}`;
}

/** Standard Luhn (Mod-10) check digit for a string of payload digits. */
export function luhnCheckDigit(payloadDigits: string): number {
  const digits = payloadDigits.replace(/\D/g, "");
  let sum = 0;
  // The check digit will sit at position 1 (from the right); payload digits
  // are doubled starting with the rightmost payload digit.
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate a full digit string (payload + check digit) with the Luhn algorithm. */
export function luhnValid(allDigits: string): boolean {
  const digits = allDigits.replace(/\D/g, "");
  if (digits.length < 2) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export type AppKind = "LA" | "VC";

function ddmmyy(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

/** Build a complete application number. `counter` is the per-district sequence (1-based). */
export function generateApplicationNumber(rtoCode: string, kind: AppKind, date: Date, counter: number): string {
  const datePart = ddmmyy(date);
  const counterPart = String(counter).padStart(4, "0");
  const payloadDigits = `${rtoCode.replace(/\D/g, "")}${datePart}${counterPart}`;
  const check = luhnCheckDigit(payloadDigits);
  return `${rtoCode}-${kind}-${datePart}-${counterPart}-${check}`;
}

export type ParsedAppNumber = {
  rtoCode: string;
  kind: AppKind;
  datePart: string;
  counter: number;
  checkDigit: number;
};

const APP_NUMBER_RE = /^([A-Z]{2}\d{2})-(LA|VC)-(\d{6})-(\d{4})-(\d)$/;

/** Parse an application number; returns null when the format is wrong. */
export function parseApplicationNumber(raw: string): ParsedAppNumber | null {
  const m = APP_NUMBER_RE.exec(raw.trim().toUpperCase());
  if (!m) return null;
  return {
    rtoCode: m[1]!,
    kind: m[2] as AppKind,
    datePart: m[3]!,
    counter: Number(m[4]),
    checkDigit: Number(m[5]),
  };
}

/**
 * Full validation used by Track Application: correct format AND a correct
 * Luhn check digit. Returns a reason so the UI can show a precise error.
 */
export function validateApplicationNumber(raw: string): { ok: true; parsed: ParsedAppNumber } | { ok: false; reason: "format" | "checksum" } {
  const parsed = parseApplicationNumber(raw);
  if (!parsed) return { ok: false, reason: "format" };
  const payloadDigits = `${parsed.rtoCode.replace(/\D/g, "")}${parsed.datePart}${String(parsed.counter).padStart(4, "0")}`;
  if (!luhnValid(`${payloadDigits}${parsed.checkDigit}`)) return { ok: false, reason: "checksum" };
  return { ok: true, parsed };
}

/** DBT reference for a victim-compensation claim: DLSA-VC-<year>-<5-digit sequence>. */
export function generateDbtRef(date: Date, sequence: number): string {
  return `DLSA-VC-${date.getFullYear()}-${String(sequence).padStart(5, "0")}`;
}

export const DBT_REF_RE = /^DLSA-VC-\d{4}-\d{5}$/;

export function isDbtRef(raw: string): boolean {
  return DBT_REF_RE.test(raw.trim().toUpperCase());
}

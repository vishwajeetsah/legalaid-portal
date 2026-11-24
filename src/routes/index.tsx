import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpenText, HandHeart, ScrollText, Search, Siren, Wallet } from "lucide-react";
import { SpeakButton } from "@/components/SpeakButton";
import { ClaimWizard } from "@/components/ClaimWizard";
import { TrackApplication } from "@/components/TrackApplication";
import { TrackDbt } from "@/components/TrackDbt";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LegalAid India — Free Legal Aid & Victim Compensation Portal" },
      {
        name: "description",
        content:
          "Claim free legal aid or victim compensation anywhere in India, track your application with its unique number, and follow DBT compensation until it reaches your bank. Under the Legal Services Authorities Act, 1987.",
      },
      { property: "og:title", content: "LegalAid India — Free Legal Aid & Victim Compensation Portal" },
      {
        property: "og:description",
        content: "Claim, track and follow compensation — one citizen portal for legal aid and victim compensation (DBT).",
      },
    ],
  }),
  component: PortalHome,
});

type TabId = "claim" | "track" | "dbt";

function PortalHome() {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<TabId>("claim");

  const tabs: { id: TabId; icon: typeof HandHeart; label: string }[] = [
    { id: "claim", icon: HandHeart, label: t("tabClaim") },
    { id: "track", icon: Search, label: t("tabTrack") },
    { id: "dbt", icon: Wallet, label: t("tabDbt") },
  ];

  return (
    <main className="page-enter mx-auto w-full max-w-3xl px-4 pb-16">
      <section className="card-enter mt-6 rounded-lg border border-border border-l-4 border-l-accent bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
              {lang === "hi" ? "विधिक सेवा प्राधिकरण अधिनियम, 1987" : "Legal Services Authorities Act, 1987"}
            </span>
            <h1 className="mt-3 font-serif text-3xl leading-tight font-bold text-primary sm:text-4xl">{t("portalTitle")}</h1>
          </div>
          <SpeakButton text={`${t("portalTitle")}. ${t("portalBody")}`} />
        </div>
        <p className="mt-3 text-base text-foreground/90">{t("portalBody")}</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/60 bg-accent/10 px-3 py-1 text-xs font-semibold text-primary">
          {t("demoBadge")}
        </p>
      </section>

      <div role="tablist" aria-label={t("portalTitle")} className="card-enter mt-6 grid grid-cols-3 gap-2 [animation-delay:60ms]">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`tactile-button flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-center text-sm font-bold sm:flex-row sm:justify-center sm:gap-2 sm:text-base ${
              tab === tb.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-primary hover:border-primary/40"
            }`}
          >
            <tb.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {tb.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "claim" && <ClaimWizard onGoTrack={() => setTab("track")} onGoDbt={() => setTab("dbt")} />}
        {tab === "track" && <TrackApplication />}
        {tab === "dbt" && <TrackDbt />}
      </div>

      <Link
        to="/guide"
        hash="pre-arrest"
        className="card-enter mt-6 flex items-start gap-4 rounded-lg border-2 border-accent/60 bg-accent/10 p-6 shadow-sm"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
          <Siren className="h-5 w-5" aria-hidden="true" />
        </span>
        <span>
          <span className="block font-serif text-xl font-bold text-primary">{t("preArrestCardTitle")}</span>
          <span className="mt-1 block text-base text-foreground/90">{t("preArrestCardBody")}</span>
        </span>
      </Link>

      <Link
        to="/guide"
        className="card-enter mt-4 flex items-center gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BookOpenText className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="font-serif text-xl font-bold text-primary">{t("toGuide")}</span>
      </Link>

      <p className="mt-6 text-sm text-muted-foreground">{t("disclaimer")}</p>
    </main>
  );
}

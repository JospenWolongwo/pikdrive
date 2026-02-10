"use client";

import Link from "next/link";
import { WifiOff, ShieldCheck, MessageCircle, CreditCard, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { useLocale } from "@/hooks";

export default function OfflinePage() {
  const { t } = useLocale();

  const handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/30">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="flex w-full flex-col items-center gap-8">
          <div className="flex items-center gap-3 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <WifiOff className="h-4 w-4" />
            PikDrive
          </div>

          <div className="w-full max-w-2xl space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {t("offline.title")}
            </h1>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("offline.subtitle")}
            </p>
            <p className="text-base text-muted-foreground sm:text-lg">
              {t("offline.body")}
            </p>
          </div>

          <div className="grid w-full max-w-3xl gap-4 rounded-3xl border border-muted bg-background/80 p-6 shadow-lg backdrop-blur sm:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{t("offline.tipsTitle")}</h2>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span>{t("offline.tip1")}</span>
                </li>
                <li className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <span>{t("offline.tip2")}</span>
                </li>
                <li className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span>{t("offline.tip3")}</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-primary/10 bg-primary/5 p-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-primary">
                  {t("offline.description")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("offline.body")}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button onClick={handleRetry} className="w-full sm:w-auto">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("offline.tryAgain")}
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/">
                    {t("offline.backHome")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

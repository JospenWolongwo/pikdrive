"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentLoader } from "@/components/ui/content-loader";
import { PayoutStatusChecker } from "@/components/payout/payout-status-checker";
import type { PayoutStatus } from "@/types/payout";
import { usePayoutStatistics, useLocale } from "@/hooks";

export function PaymentStatistics() {
  const { t, locale } = useLocale();
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | "all">("all");
  const { payouts, statistics, loading, error, refresh } = usePayoutStatistics({
    status: statusFilter,
    limit: 50,
  });

  const formatCurrency = (amount: number) => {
    const localeCode = locale === "fr" ? "fr-FR" : "en-US";
    return new Intl.NumberFormat(localeCode, {
      style: "currency",
      currency: "XAF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: PayoutStatus) => {
    const variants: Record<PayoutStatus, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      pending: {
        variant: "outline",
        className: "bg-yellow-50 text-yellow-700 border-yellow-200",
      },
      processing: {
        variant: "outline",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      },
      completed: {
        variant: "outline",
        className: "bg-green-50 text-green-700 border-green-200",
      },
      failed: {
        variant: "destructive",
        className: "bg-red-50 text-red-700 border-red-200",
      },
    };

    const config = variants[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {t(`pages.driver.dashboard.payments.statistics.statusLabels.${status}`)}
      </Badge>
    );
  };

  if (loading && payouts.length === 0) {
    return <ContentLoader size="lg" message={t("pages.driver.dashboard.payments.statistics.loading")} />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => refresh()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("pages.driver.dashboard.payments.statistics.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("pages.driver.dashboard.payments.statistics.totalEarnings")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalEarnings)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.driver.dashboard.payments.statistics.completedPayments", { count: statistics.completedCount })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("pages.driver.dashboard.payments.statistics.pending")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.pendingAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.driver.dashboard.payments.statistics.awaitingProcessing")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("pages.driver.dashboard.payments.statistics.thisMonth")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.thisMonthEarnings)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.driver.dashboard.payments.statistics.currentMonthEarnings")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("pages.driver.dashboard.payments.statistics.totalPayments")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.driver.dashboard.payments.statistics.completedAndFailed", { completed: statistics.completedCount, failed: statistics.failedCount })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>{t("pages.driver.dashboard.payments.statistics.paymentHistory")}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                {t("pages.driver.dashboard.payments.statistics.refresh")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={statusFilter} onValueChange={(v) => setStatusFilter(v as PayoutStatus | "all")}>
            <div className="overflow-x-auto mb-4 -mx-4 px-4">
              <TabsList className="mb-0 inline-flex min-w-full sm:min-w-0">
                <TabsTrigger value="all" className="whitespace-nowrap">{t("pages.driver.dashboard.payments.all")}</TabsTrigger>
                <TabsTrigger value="pending" className="whitespace-nowrap">{t("pages.driver.dashboard.payments.pending")}</TabsTrigger>
                <TabsTrigger value="processing" className="whitespace-nowrap">{t("pages.driver.dashboard.payments.processing")}</TabsTrigger>
                <TabsTrigger value="completed" className="whitespace-nowrap">{t("pages.driver.dashboard.payments.completed")}</TabsTrigger>
                <TabsTrigger value="failed" className="whitespace-nowrap">{t("pages.driver.dashboard.payments.failed")}</TabsTrigger>
              </TabsList>
            </div>

            {payouts.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {statusFilter === "all"
                    ? t("pages.driver.dashboard.payments.noPayments")
                    : t("pages.driver.dashboard.payments.noPaymentsFiltered", {
                        status: statusFilter === "pending" ? t("pages.driver.dashboard.payments.pendingStatus")
                          : statusFilter === "processing" ? t("pages.driver.dashboard.payments.processingStatus")
                          : statusFilter === "completed" ? t("pages.driver.dashboard.payments.completedStatus")
                          : t("pages.driver.dashboard.payments.failedStatus")
                      })}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium">{t("pages.driver.dashboard.payments.date")}</th>
                      <th className="text-left p-3 text-sm font-medium">{t("pages.driver.dashboard.payments.ride")}</th>
                      <th className="text-left p-3 text-sm font-medium">{t("pages.driver.dashboard.payments.amount")}</th>
                      <th className="text-left p-3 text-sm font-medium">{t("pages.driver.dashboard.payments.fees")}</th>
                      <th className="text-left p-3 text-sm font-medium">{t("pages.driver.dashboard.payments.status")}</th>
                      <th className="text-left p-3 text-sm font-medium">{t("pages.driver.dashboard.payments.transaction")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => {
                      const isProcessing = payout.status === 'processing' || payout.status === 'pending';
                      const isRecent = new Date(payout.created_at).getTime() > Date.now() - 5 * 60 * 1000; // Within last 5 minutes
                      const shouldShowChecker = isProcessing && isRecent;
                      
                      return (
                        <tr key={payout.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 text-sm">
                            {format(new Date(payout.created_at), "dd MMM yyyy, HH:mm", {
                              locale: locale === "fr" ? fr : enUS,
                            })}
                          </td>
                          <td className="p-3 text-sm">
                            {payout.booking?.ride ? (
                              <div>
                                <div className="font-medium">
                                  {payout.booking.ride.from_city} → {payout.booking.ride.to_city}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {payout.booking.seats} {payout.booking.seats > 1 ? t("pages.driver.dashboard.payments.places") : t("pages.driver.dashboard.payments.place")}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{t("pages.driver.dashboard.payments.statistics.notAvailable")}</span>
                            )}
                          </td>
                          <td className="p-3 text-sm font-medium">
                            {formatCurrency(payout.amount)}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            <div className="text-xs">
                              <div>{t("pages.driver.dashboard.payments.fee")}: {formatCurrency(payout.transaction_fee)}</div>
                              <div>{t("pages.driver.dashboard.payments.commission")}: {formatCurrency(payout.commission)}</div>
                            </div>
                          </td>
                          <td className="p-3 text-sm">
                            <div className="flex flex-col gap-1">
                              {getStatusBadge(payout.status)}
                              {shouldShowChecker && (
                                <PayoutStatusChecker
                                  transactionId={payout.transaction_id || ''}
                                  payoutId={payout.id}
                                  provider={payout.provider || 'mtn'}
                                  onStatusChange={(newStatus) => {
                                    // Refresh payouts when status changes
                                    refresh();
                                  }}
                                  onComplete={(finalStatus) => {
                                    // Refresh payouts when completed
                                    refresh();
                                  }}
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-sm">
                            {payout.transaction_id ? (
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {payout.transaction_id.slice(0, 8)}...
                              </code>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}


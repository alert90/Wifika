"use client";

import { useCallback, useEffect, useState } from "react";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Play, Clock } from "lucide-react";
import { formattoNairobi } from "@/lib/utils/dateUtils";

interface CronHistoryItem {
  id: string;
  type: string;
  status: "running" | "success" | "error";
  startedAt: string | Date;
  completedAt?: string | Date | null;
  duration?: number | null;
  result?: string | null;
  error?: string | null;
}

interface JobRecentHistory {
  id: string;
  status: "running" | "success" | "error";
  startedAt: string;
  completedAt?: string | null;
  duration?: number | null;
  result?: string | null;
  error?: string | null;
}

interface CronJob {
  type: string;
  name: string;
  description: string;
  scheduleLabel: string;
  enabled: boolean;
  health: "healthy" | "degraded" | "error";
  lastRun?: { startedAt: string; duration?: number };
  nextRun: string;
  recentHistory?: JobRecentHistory[];
}

export default function CronSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [history, setHistory] = useState<CronHistoryItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>("all");

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/cron/status");
      const data = await res.json();
      if (data.success) {
        const jobList: CronJob[] = data.jobs || [];
        setJobs(jobList);

        const allHistory: CronHistoryItem[] = jobList.flatMap((job) =>
          (job.recentHistory || []).map((h) => ({
            id: h.id,
            type: job.type,
            status: h.status,
            startedAt: h.startedAt,
            completedAt: h.completedAt ?? null,
            duration: h.duration ?? null,
            result: h.result ?? null,
            error: h.error ?? null,
          }))
        );

        const sortedHistory = allHistory
          .sort(
            (a, b) =>
              new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          )
          .slice(0, 50);

        setHistory(sortedHistory);
      }
    } catch (error) {
      console.error("Load history error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await loadHistory();
    };
    void run();
    const interval = setInterval(() => {
      void loadHistory();
    }, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadHistory]);

  const triggerManual = async (jobType: string) => {
    setTriggering(jobType);
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: jobType }),
      });
      const data = await res.json();

      if (data.success) {
        if (jobType === "voucher_sync") {
          await showSuccess(`Success! Synced ${data.synced} voucher(s)`);
        } else if (jobType === "agent_sales") {
          await showSuccess(`Success! Recorded ${data.recorded} sales`);
        } else if (jobType === "invoice_generate") {
          await showSuccess(
            `Success! Generated ${data.generated} invoices, skipped ${data.skipped}`
          );
        } else if (jobType === "invoice_reminder") {
          await showSuccess(
            `Success! Sent ${data.sent} reminders, skipped ${data.skipped}`
          );
        } else if (jobType === "auto_isolir") {
          await showSuccess(`Success! Isolated ${data.isolated} expired user(s)`);
        } else {
          await showSuccess("Job completed successfully!");
        }
      } else {
        await showError("Failed: " + data.error);
      }

      void loadHistory();
    } catch (error) {
      console.error("Manual trigger error:", error);
      await showError("Failed to trigger job");
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cron Jobs</h1>
          <p className="text-gray-500 mt-1">Background tasks and scheduled jobs</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadHistory} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {jobs.map((job) => (
          <Card key={job.type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                {job.name}
              </CardTitle>
              <CardDescription className="text-xs">{job.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Schedule:</span>
                    <div className="font-medium">{job.scheduleLabel}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <div>
                      <Badge
                        className={
                          job.health === "healthy"
                            ? "bg-green-100 text-green-800 text-xs"
                            : job.health === "degraded"
                            ? "bg-yellow-100 text-yellow-800 text-xs"
                            : "bg-red-100 text-red-800 text-xs"
                        }
                      >
                        {job.health === "healthy"
                          ? "🟢"
                          : job.health === "degraded"
                          ? "🟡"
                          : "🔴"}{" "}
                        {job.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-gray-500">Last Run:</span>
                    <div className="font-medium">
                      {job.lastRun ? formattoNairobi(job.lastRun.startedAt) : "Never"}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Next Run:</span>
                    <div className="font-medium text-blue-600">
                      {formattoNairobi(job.nextRun)}
                    </div>
                  </div>
                  {job.lastRun?.duration && (
                    <div>
                      <span className="text-gray-500">Duration:</span>
                      <div className="font-medium">
                        {(job.lastRun.duration / 1000).toFixed(2)}s
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => triggerManual(job.type)}
                  size="sm"
                  className="w-full"
                  disabled={triggering !== null}
                >
                  <Play className="h-3 w-3 mr-2" />
                  {triggering === job.type ? "Running..." : "Trigger Now"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>Last 50 executions</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setSelectedType("all")}
                variant={selectedType === "all" ? "default" : "outline"}
                size="sm"
              >
                All
              </Button>
              {jobs.map((job) => (
                <Button
                  key={job.type}
                  onClick={() => setSelectedType(job.type)}
                  variant={selectedType === job.type ? "default" : "outline"}
                  size="sm"
                >
                  {job.name}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Started At</TableHead>
                  <TableHead>Completed At</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedType === "all"
                  ? history
                  : history.filter((h) => h.type === selectedType)
                ).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No execution history yet
                    </TableCell>
                  </TableRow>
                ) : (
                  (selectedType === "all"
                    ? history
                    : history.filter((h) => h.type === selectedType)
                  ).map((item) => {
                    const duration = item.completedAt
                      ? Math.round(
                          (new Date(item.completedAt).getTime() -
                            new Date(item.startedAt).getTime()) /
                            1000
                        )
                      : null;

                    const typeLabels: Record<string, string> = {
                      voucher_sync: "Voucher Sync",
                      agent_sales: "Agent Sales",
                      invoice_generate: "Invoice Gen",
                      invoice_reminder: "Reminders",
                      auto_isolir: "Auto Isolir",
                      notification_check: "Notification Check",
                      telegram_backup: "Telegram Backup",
                      telegram_health: "Telegram Health",
                    };

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">
                          <Badge variant="outline" className="text-xs">
                            {typeLabels[item.type] || item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formattoNairobi(item.startedAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.completedAt ? formattoNairobi(item.completedAt) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {duration ? `${duration}s` : "-"}
                        </TableCell>
                        <TableCell>
                          {item.status === "success" && (
                            <Badge className="bg-green-100 text-green-800">Success</Badge>
                          )}
                          {item.status === "error" && (
                            <Badge className="bg-red-100 text-red-800">Error</Badge>
                          )}
                          {item.status === "running" && (
                            <Badge className="bg-blue-100 text-blue-800">Running</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.status === "success" && item.result}
                          {item.status === "error" && (
                            <span className="text-red-600">{item.error}</span>
                          )}
                          {item.status === "running" && "In progress..."}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
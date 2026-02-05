"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@/components/ui";
import { useAdminAccess } from "@/hooks/admin";
import { useLocale } from "@/hooks";
import { allCameroonCities } from "@/app/data/cities";
import { Loader2, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import type { CityPickupPoint } from "@/types";

export default function AdminPickupPointsPage() {
  const { isAdmin, loading: adminLoading } = useAdminAccess();
  const { t } = useLocale();
  const [list, setList] = useState<CityPickupPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCity, setFormCity] = useState("");
  const [formName, setFormName] = useState("");
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const url = cityFilter
        ? `/api/admin/pickup-points?city=${encodeURIComponent(cityFilter)}`
        : "/api/admin/pickup-points";
      const res = await fetch(url);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to load");
      }
      setList(result.data || []);
    } catch (e) {
      toast({
        title: t("pages.admin.pickupPoints.errors.loadFailed"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, t]);

  useEffect(() => {
    if (isAdmin === true) {
      loadList();
    }
  }, [isAdmin, loadList]);

  const openCreate = () => {
    setEditingId(null);
    setFormCity((cityFilter || allCameroonCities[0]) ?? "");
    setFormName("");
    setFormDisplayOrder(0);
    setModalOpen(true);
  };

  const openEdit = (row: CityPickupPoint) => {
    setEditingId(row.id);
    setFormCity(row.city);
    setFormName(row.name);
    setFormDisplayOrder(row.display_order);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const name = formName.trim();
    if (!name) {
      toast({
        title: t("pages.admin.pickupPoints.validation.nameRequired"),
        variant: "destructive",
      });
      return;
    }
    if (!formCity) {
      toast({
        title: t("pages.admin.pickupPoints.validation.cityRequired"),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/pickup-points/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            display_order: formDisplayOrder,
          }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.error || "Update failed");
        }
        toast({ title: t("pages.admin.pickupPoints.toast.updated") });
      } else {
        const res = await fetch("/api/admin/pickup-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: formCity,
            name,
            display_order: formDisplayOrder,
          }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.error || "Create failed");
        }
        toast({ title: t("pages.admin.pickupPoints.toast.created") });
      }
      setModalOpen(false);
      loadList();
    } catch (e) {
      toast({
        title: t("pages.admin.pickupPoints.errors.saveFailed"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/pickup-points/${id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Delete failed");
      }
      toast({ title: t("pages.admin.pickupPoints.toast.deleted") });
      loadList();
    } catch (e) {
      toast({
        title: t("pages.admin.pickupPoints.errors.deleteFailed"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const citiesSorted = [...allCameroonCities].sort();

  if (isAdmin === false || (isAdmin === null && !adminLoading)) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {t("pages.admin.pickupPoints.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("pages.admin.pickupPoints.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadList} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("pages.admin.pickupPoints.refresh")}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("pages.admin.pickupPoints.add")}
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">
              {t("pages.admin.pickupPoints.filterByCity")}
            </Label>
            <Select
              value={cityFilter || "all"}
              onValueChange={(v) => setCityFilter(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("pages.admin.pickupPoints.allCities")}</SelectItem>
                {citiesSorted.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("pages.admin.pickupPoints.table.city")}</TableHead>
              <TableHead>{t("pages.admin.pickupPoints.table.name")}</TableHead>
              <TableHead>{t("pages.admin.pickupPoints.table.displayOrder")}</TableHead>
              <TableHead className="w-[120px]">{t("pages.admin.pickupPoints.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || adminLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  {t("pages.admin.pickupPoints.noPoints")}
                </TableCell>
              </TableRow>
            ) : (
              list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.city}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.display_order}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        {deletingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t("pages.admin.pickupPoints.editTitle")
                : t("pages.admin.pickupPoints.createTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("pages.admin.pickupPoints.form.city")}</Label>
              <Select
                value={formCity}
                onValueChange={setFormCity}
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("pages.admin.pickupPoints.form.cityPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {citiesSorted.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("pages.admin.pickupPoints.form.name")}</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("pages.admin.pickupPoints.form.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("pages.admin.pickupPoints.form.displayOrder")}</Label>
              <Input
                type="number"
                value={formDisplayOrder}
                onChange={(e) => setFormDisplayOrder(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? t("common.save") : t("pages.admin.pickupPoints.form.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

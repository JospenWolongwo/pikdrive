import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@/components/ui";
import type { TranslateFn } from "../types";

interface NoShowDialogProps {
  t: TranslateFn;
  open: boolean;
  markingNoShowId: string | null;
  noShowContactAttempted: boolean;
  noShowNote: string;
  setNoShowContactAttempted: (value: boolean) => void;
  setNoShowNote: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  onCloseAndReset: () => void;
}

export function NoShowDialog({
  t,
  open,
  markingNoShowId,
  noShowContactAttempted,
  noShowNote,
  setNoShowContactAttempted,
  setNoShowNote,
  onConfirm,
  onCloseAndReset,
}: NoShowDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !markingNoShowId) {
          onCloseAndReset();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pages.driver.manageRide.bookings.markNoShowTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.driver.manageRide.bookings.markNoShowDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="no-show-contact-attempted"
              checked={noShowContactAttempted}
              onCheckedChange={(checked) =>
                setNoShowContactAttempted(Boolean(checked))
              }
            />
            <Label htmlFor="no-show-contact-attempted" className="leading-5">
              {t("pages.driver.manageRide.bookings.contactAttempted")}
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="no-show-note">
              {t("pages.driver.manageRide.bookings.noteLabel")}
            </Label>
            <Textarea
              id="no-show-note"
              value={noShowNote}
              onChange={(event) => setNoShowNote(event.target.value)}
              placeholder={t("pages.driver.manageRide.bookings.notePlaceholder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCloseAndReset}
            disabled={Boolean(markingNoShowId)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!noShowContactAttempted || Boolean(markingNoShowId)}
          >
            {markingNoShowId
              ? t("pages.driver.manageRide.bookings.confirmingNoShow")
              : t("pages.driver.manageRide.bookings.confirmMarkNoShow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

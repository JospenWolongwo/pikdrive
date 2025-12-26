interface NavigationOverlayProps {
  isVisible: boolean;
}

export function NavigationOverlay({ isVisible }: NavigationOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Redirection en cours...</p>
      </div>
    </div>
  );
}


"use client";

import { useTranslation } from "@/lib/i18n";

/**
 * Real-time caption overlay — shows transcript + translation.
 */

interface CaptionOverlayProps {
  transcript: string;
  translation: string;
}

export function CaptionOverlay({ transcript, translation }: CaptionOverlayProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-md space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
      {/* Original transcript */}
      {transcript && (
        <div>
          <span className="text-xs font-medium uppercase text-muted-foreground">
            {t("call.original")}
          </span>
          <p className="mt-1 text-sm text-muted-foreground">{transcript}</p>
        </div>
      )}

      {/* Translation */}
      {translation && (
        <div>
          <span className="text-xs font-medium uppercase text-primary">
            {t("call.translation")}
          </span>
          <p className="mt-1 text-lg font-medium">{translation}</p>
        </div>
      )}

      {/* Empty state */}
      {!transcript && !translation && (
        <p className="text-center text-sm text-muted-foreground">
          {t("call.listening")}
        </p>
      )}
    </div>
  );
}

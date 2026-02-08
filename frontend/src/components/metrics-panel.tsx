/**
 * Pipeline latency metrics panel — dev/debug tool.
 */

interface MetricsPanelProps {
  metrics: {
    stt_ms: number;
    translate_ms: number;
    tts_ms: number;
    total_ms: number;
  };
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  const getLatencyColor = (ms: number) => {
    if (ms < 100) return "text-green-400";
    if (ms < 200) return "text-yellow-400";
    return "text-red-400";
  };

  const rows = [
    { label: "STT (Deepgram)", value: metrics.stt_ms },
    { label: "Translate (GPT-4)", value: metrics.translate_ms },
    { label: "TTS (ElevenLabs)", value: metrics.tts_ms },
    { label: "Total Pipeline", value: metrics.total_ms },
  ];

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
        Pipeline Latency
      </h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span className={`font-mono text-sm font-bold ${getLatencyColor(row.value)}`}>
              {row.value.toFixed(0)}ms
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            metrics.total_ms < 500 ? "bg-green-500" : "bg-red-500"
          }`}
          style={{ width: `${Math.min((metrics.total_ms / 500) * 100, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-muted-foreground">
        Target: &lt;500ms
      </p>
    </div>
  );
}

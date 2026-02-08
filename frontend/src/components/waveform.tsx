/**
 * Audio waveform visualization — shows audio activity during a call.
 */

interface WaveformProps {
  isActive: boolean;
}

export function Waveform({ isActive }: WaveformProps) {
  return (
    <div className="flex h-24 items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`waveform-bar w-1.5 rounded-full transition-all ${
            isActive ? "bg-primary" : "bg-muted-foreground/30"
          }`}
          style={{
            height: isActive ? undefined : "4px",
            animationPlayState: isActive ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}

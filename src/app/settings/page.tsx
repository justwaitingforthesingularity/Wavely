export default function Settings() {
  return (
    <div className="animate-fadeIn px-5 pt-14">
      <h1 className="text-[28px] font-bold tracking-tight mb-6">Settings</h1>

      <div className="space-y-8">
        <SettingSection title="Playback">
          <SettingRow label="Audio Quality" value="High" />
          <SettingRow label="Crossfade" value="Off" />
          <SettingRow label="Gapless Playback" value="On" />
        </SettingSection>

        <SettingSection title="Storage">
          <SettingRow label="Downloads" value="0 songs" />
          <SettingRow label="Cache" value="0 MB" />
          <SettingRow label="Clear Cache" value="" action />
        </SettingSection>

        <SettingSection title="Appearance">
          <SettingRow label="Theme" value="Dark" />
          <SettingRow label="Dynamic Colors" value="On" />
        </SettingSection>

        <SettingSection title="About">
          <SettingRow label="Version" value="0.1.0" />
          <SettingRow label="App" value="Wavely" />
        </SettingSection>
      </div>
    </div>
  );
}

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[11px] text-white/25 uppercase tracking-[0.12em] font-semibold mb-2.5 pl-1">
        {title}
      </h2>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.04] overflow-hidden divide-y divide-white/[0.04]">
        {children}
      </div>
    </section>
  );
}

function SettingRow({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors cursor-pointer">
      <span className={`text-[14px] ${action ? "text-red-400" : "text-white/80"}`}>
        {label}
      </span>
      {value && (
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] text-white/25">{value}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="w-3.5 h-3.5 text-white/15"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m8.25 4.5 7.5 7.5-7.5 7.5"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

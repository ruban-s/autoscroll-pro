import { useState, useEffect } from "react";
import {
  Settings,
  User,
  Keyboard,
  Palette,
  Info,
  Save,
  Trash2,
  Plus,
  Download,
  Upload,
} from "lucide-react";
import {
  defaultConfig,
  theme as themeSetting,
  speedZones,
  profiles as profilesSetting,
  customShortcuts,
} from "@/utils/storage";
import { DEFAULT_CONFIG, DEFAULT_SPEED_ZONES } from "@/utils/constants";
import type {
  ScrollConfig,
  ContentType,
  ScrollProfile,
  ScrollDirection,
  ScrollMode,
} from "@/types";

type Tab = "general" | "profiles" | "shortcuts" | "appearance" | "about";

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "profiles", label: "Profiles", icon: User },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "about", label: "About", icon: Info },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="flex min-h-screen">
      <nav className="w-56 bg-white border-r border-gray-200 p-4 space-y-1">
        <h1 className="text-lg font-bold text-gray-900 mb-6 px-3">
          AutoScroll Pro
        </h1>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              tab === id
                ? "bg-emerald-50 text-emerald-700 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 p-8 max-w-3xl">
        {tab === "general" && <GeneralSettings />}
        {tab === "profiles" && <ProfileSettings />}
        {tab === "shortcuts" && <ShortcutSettings />}
        {tab === "appearance" && <AppearanceSettings />}
        {tab === "about" && <AboutSection />}
      </main>
    </div>
  );
}

function GeneralSettings() {
  const [config, setConfig] = useState<ScrollConfig>(DEFAULT_CONFIG);
  const [zones, setZones] = useState(DEFAULT_SPEED_ZONES);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    defaultConfig.getValue().then(setConfig);
    speedZones.getValue().then(setZones);
  }, []);

  const save = async () => {
    await defaultConfig.setValue(config);
    await speedZones.setValue(zones);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">General</h2>
        <p className="text-sm text-gray-500">Default scrolling behavior</p>
      </div>

      <Section title="Speed & Mode">
        <Field label="Default Speed">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={100}
              value={config.speed}
              onChange={(e) =>
                setConfig({ ...config, speed: Number(e.target.value) })
              }
              className="flex-1 accent-emerald-500"
            />
            <span className="text-sm font-mono w-8 text-right">
              {config.speed}
            </span>
          </div>
        </Field>

        <Field label="Direction">
          <select
            value={config.direction}
            onChange={(e) =>
              setConfig({
                ...config,
                direction: e.target.value as ScrollDirection,
              })
            }
            className="input"
          >
            <option value="down">Down</option>
            <option value="up">Up</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </Field>

        <Field label="Scroll Mode">
          <select
            value={config.mode}
            onChange={(e) =>
              setConfig({ ...config, mode: e.target.value as ScrollMode })
            }
            className="input"
          >
            <option value="smooth">Smooth</option>
            <option value="step">Step-by-step</option>
          </select>
        </Field>

        {config.mode === "step" && (
          <>
            <Field label="Step Size (px)">
              <input
                type="number"
                value={config.stepSize}
                onChange={(e) =>
                  setConfig({ ...config, stepSize: Number(e.target.value) })
                }
                className="input"
                min={50}
                max={2000}
              />
            </Field>
            <Field label="Step Interval (ms)">
              <input
                type="number"
                value={config.stepInterval}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    stepInterval: Number(e.target.value),
                  })
                }
                className="input"
                min={200}
                max={10000}
              />
            </Field>
          </>
        )}
      </Section>

      <Section title="Behavior">
        <Toggle
          label="Auto-pause on interaction"
          description="Pause when you scroll or click, resume after 2 seconds"
          checked={config.autoPauseOnInteraction}
          onChange={(v) => setConfig({ ...config, autoPauseOnInteraction: v })}
        />
        <Toggle
          label="Timer mode"
          description="Stop scrolling after a set duration"
          checked={config.timerEnabled}
          onChange={(v) => setConfig({ ...config, timerEnabled: v })}
        />
        {config.timerEnabled && (
          <Field label="Timer Duration (minutes)">
            <input
              type="number"
              value={Math.round(config.timerDurationMs / 60000)}
              onChange={(e) =>
                setConfig({
                  ...config,
                  timerDurationMs: Number(e.target.value) * 60000,
                })
              }
              className="input"
              min={1}
              max={120}
            />
          </Field>
        )}
      </Section>

      <Section title="Speed Zones">
        <p className="text-sm text-gray-500 mb-3">
          Default speed per detected content type
        </p>
        {(Object.keys(zones) as ContentType[]).map((type) => (
          <Field key={type} label={type}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={zones[type]}
                onChange={(e) =>
                  setZones({ ...zones, [type]: Number(e.target.value) })
                }
                className="flex-1 accent-emerald-500"
              />
              <span className="text-sm font-mono w-8 text-right">
                {zones[type]}
              </span>
            </div>
          </Field>
        ))}
      </Section>

      <button
        onClick={save}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
      >
        <Save size={16} />
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}

function ProfileSettings() {
  const [list, setList] = useState<ScrollProfile[]>([]);
  const [editing, setEditing] = useState<ScrollProfile | null>(null);

  useEffect(() => {
    profilesSetting.getValue().then(setList);
  }, []);

  const saveProfiles = async (updated: ScrollProfile[]) => {
    setList(updated);
    await profilesSetting.setValue(updated);
  };

  const addProfile = () => {
    const profile: ScrollProfile = {
      id: crypto.randomUUID(),
      name: "New Profile",
      config: {},
      sitePatterns: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditing(profile);
  };

  const saveProfile = async (profile: ScrollProfile) => {
    const existing = list.findIndex((p) => p.id === profile.id);
    const updated =
      existing >= 0
        ? list.map((p) =>
            p.id === profile.id
              ? { ...profile, updatedAt: Date.now() }
              : p,
          )
        : [...list, { ...profile, updatedAt: Date.now() }];
    await saveProfiles(updated);
    setEditing(null);
  };

  const deleteProfile = async (id: string) => {
    await saveProfiles(list.filter((p) => p.id !== id));
  };

  const exportProfiles = () => {
    const blob = new Blob([JSON.stringify(list, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "autoscroll-profiles.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProfiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const imported = JSON.parse(text) as ScrollProfile[];
        await saveProfiles([...list, ...imported]);
      } catch {}
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            Profiles
          </h2>
          <p className="text-sm text-gray-500">
            Per-site scroll configurations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={importProfiles}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={exportProfiles}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={addProfile}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
          >
            <Plus size={14} /> New Profile
          </button>
        </div>
      </div>

      {editing && (
        <ProfileEditor
          profile={editing}
          onSave={saveProfile}
          onCancel={() => setEditing(null)}
        />
      )}

      {list.length === 0 && !editing && (
        <p className="text-gray-400 text-center py-12">
          No profiles yet. Create one to save per-site settings.
        </p>
      )}

      {list.map((profile) => (
        <div
          key={profile.id}
          className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
        >
          <div>
            <p className="font-medium text-gray-900">{profile.name}</p>
            <p className="text-sm text-gray-500">
              {profile.sitePatterns.join(", ") || "No site patterns"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(profile)}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
            >
              Edit
            </button>
            <button
              onClick={() => deleteProfile(profile.id)}
              className="p-1 text-red-400 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: ScrollProfile;
  onSave: (p: ScrollProfile) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [patterns, setPatterns] = useState(
    profile.sitePatterns.join("\n"),
  );

  return (
    <div className="p-4 bg-white rounded-lg border-2 border-emerald-200 space-y-4">
      <Field label="Profile Name">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Site Patterns (one per line)">
        <textarea
          value={patterns}
          onChange={(e) => setPatterns(e.target.value)}
          placeholder="*://manga.example.com/*&#10;*://blog.example.com/*"
          className="input h-24 resize-y"
        />
      </Field>

      <Field label="Content Type Override">
        <select
          value={draft.contentType || ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              contentType: (e.target.value || undefined) as
                | ContentType
                | undefined,
            })
          }
          className="input"
        >
          <option value="">Auto-detect</option>
          <option value="general">General</option>
          <option value="pdf">PDF</option>
          <option value="manga">Manga</option>
          <option value="blog">Blog</option>
          <option value="infinite-scroll">Infinite Scroll</option>
        </select>
      </Field>

      <Field label="Speed Override">
        <input
          type="number"
          value={draft.config.speed ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              config: {
                ...draft.config,
                speed: e.target.value ? Number(e.target.value) : undefined,
              },
            })
          }
          placeholder="Use default"
          className="input"
          min={1}
          max={100}
        />
      </Field>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({
              ...draft,
              sitePatterns: patterns
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
        >
          Save Profile
        </button>
      </div>
    </div>
  );
}

function ShortcutSettings() {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});

  useEffect(() => {
    customShortcuts.getValue().then(setShortcuts);
  }, []);

  const labels: Record<string, string> = {
    toggleScroll: "Toggle Scroll",
    speedUp: "Speed Up",
    speedDown: "Speed Down",
    toggleWidget: "Toggle Widget",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Keyboard Shortcuts
        </h2>
        <p className="text-sm text-gray-500">
          Customize via browser extension settings
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(shortcuts).map(([key, value]) => (
          <div
            key={key}
            className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
          >
            <span className="text-gray-700">{labels[key] ?? key}</span>
            <kbd className="px-3 py-1 bg-gray-100 rounded text-sm font-mono text-gray-600">
              {value}
            </kbd>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        To change shortcuts, visit chrome://extensions/shortcuts
      </p>
    </div>
  );
}

function AppearanceSettings() {
  const [currentTheme, setCurrentTheme] = useState<
    "light" | "dark" | "system"
  >("system");

  useEffect(() => {
    themeSetting.getValue().then(setCurrentTheme);
  }, []);

  const updateTheme = async (value: "light" | "dark" | "system") => {
    setCurrentTheme(value);
    await themeSetting.setValue(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          Appearance
        </h2>
        <p className="text-sm text-gray-500">Theme and visual preferences</p>
      </div>

      <Section title="Theme">
        <div className="flex gap-3">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateTheme(t)}
              className={`flex-1 p-4 rounded-lg border-2 text-center capitalize transition-colors ${
                currentTheme === t
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">About</h2>
        <p className="text-sm text-gray-500">AutoScroll Pro v0.1.0</p>
      </div>
      <div className="p-4 bg-white rounded-lg border border-gray-200 space-y-2">
        <p className="text-gray-700">
          Smart auto-scroll for PDFs, manga, blogs, and the web.
        </p>
        <p className="text-sm text-gray-500">
          Supports Chrome, Firefox, and Edge.
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

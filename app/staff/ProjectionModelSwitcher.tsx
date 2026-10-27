"use client";

import { useRouter } from "next/navigation";

export type ProjectionModelId = "hoc" | "nia" | "dail";

const MODELS: Array<{ id: ProjectionModelId; label: string; href: string }> = [
  { id: "hoc", label: "House of Commons (NI) · FPTP", href: "/staff/tools/seat-projection" },
  { id: "nia", label: "Northern Ireland Assembly · STV", href: "/staff/tools/ni-assembly-projection" },
  { id: "dail", label: "Dáil Éireann · STV", href: "/staff/tools/dail-projection" },
];

type Props = {
  current: ProjectionModelId;
  enabled: ProjectionModelId[];
};

export default function ProjectionModelSwitcher({ current, enabled }: Props) {
  const router = useRouter();
  const enabledModels = new Set(enabled);

  return (
    <label className="staff-projection-model-picker">
      <span className="staff-projection-toolbar-label">Projection model</span>
      <select
        aria-label="Choose projection model"
        value={current}
        onChange={(event) => {
          const selected = MODELS.find((model) => model.id === event.target.value);
          if (selected && enabledModels.has(selected.id)) router.push(selected.href);
        }}
      >
        {MODELS.map((model) => {
          const isEnabled = enabledModels.has(model.id);
          return (
            <option key={model.id} value={model.id} disabled={!isEnabled}>
              {model.label}{isEnabled ? "" : " · coming soon"}
            </option>
          );
        })}
      </select>
    </label>
  );
}

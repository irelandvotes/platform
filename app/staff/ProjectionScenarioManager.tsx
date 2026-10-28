"use client";

import { useCallback, useEffect, useState } from "react";

export type ProjectionScenarioPreset = { id: string; label: string; settings: Record<string, unknown> };
type Scenario = { id: string; name: string; settings: Record<string, unknown>; updated_at: string };

export default function ProjectionScenarioManager({
  model,
  settings,
  presets,
  onApply,
}: {
  model: "hoc" | "nia";
  settings: Record<string, unknown>;
  presets: ProjectionScenarioPreset[];
  onApply: (settings: Record<string, unknown>) => void;
}) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState("preset:last-election");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/staff/projection-scenarios?model=${model}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load shared scenarios.");
      setScenarios(Array.isArray(body.scenarios) ? body.scenarios : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load shared scenarios.");
    }
  }, [model]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const presetId = selected.startsWith("preset:") ? selected.slice("preset:".length) : "";
  const selectedPreset = presets.find((preset) => preset.id === presetId);
  const selectedScenario = scenarios.find((scenario) => scenario.id === selected);

  function applySelected() {
    const value = selectedPreset?.settings ?? selectedScenario?.settings;
    if (value) onApply(value);
  }

  async function saveScenario(id?: string) {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/staff/projection-scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, id, name: name.trim(), settings }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save the shared scenario.");
      await refresh();
      setSelected(body.scenario.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the shared scenario.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteScenario() {
    if (!selectedScenario) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/staff/projection-scenarios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, id: selectedScenario.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not delete the shared scenario.");
      setSelected("preset:last-election");
      setName("");
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the shared scenario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="staff-projection-scenarios" aria-label="Projection starting points and shared scenarios">
      <div className="staff-projection-scenario-heading"><div><p className="staff-eyebrow">SCENARIO</p><h2>Start from a template</h2></div><span>Shared with staff</span></div>
      <div className="staff-projection-scenario-load-row">
        <label className="staff-projection-scenario-choice"><span>Choose a starting point</span><select value={selected} onChange={(event) => {
          setSelected(event.target.value);
          const scenario = scenarios.find((item) => item.id === event.target.value);
          setName(scenario?.name ?? "");
        }}>
          <optgroup label="Starting scenarios">{presets.map((preset) => <option key={preset.id} value={`preset:${preset.id}`}>{preset.label}</option>)}</optgroup>
          <optgroup label="Shared custom scenarios">{scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</optgroup>
        </select></label>
        <button type="button" className="staff-projection-scenario-apply" onClick={applySelected} disabled={busy || (!selectedPreset && !selectedScenario)}>Apply to inputs</button>
      </div>
      <details className="staff-projection-scenario-manage">
        <summary>Manage shared scenarios</summary>
        <div className="staff-projection-scenario-content">
          <label className="staff-projection-scenario-name"><span>Scenario name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="e.g. Candidate slate · May 2027" /></label>
          <div className="staff-projection-scenario-actions">
            <button type="button" className="is-primary" onClick={() => void saveScenario()} disabled={busy || !name.trim()}>Save current inputs</button>
            {selectedScenario && <button type="button" onClick={() => void saveScenario(selectedScenario.id)} disabled={busy || !name.trim()}>Update selected</button>}
            {selectedScenario && <button type="button" className="is-delete" onClick={() => void deleteScenario()} disabled={busy}>Delete selected</button>}
            <button type="button" onClick={() => void refresh()} disabled={busy}>Refresh list</button>
          </div>
          <p>Custom scenarios are shared with staff across browsers and devices.</p>
        </div>
      </details>
      {error && <p className="staff-projection-scenario-error staff-projection-scenario-load-error" role="alert">{error}</p>}
    </section>
  );
}

import { useState } from "react";
import { House, Check } from "lucide-react";
import { useCatalog } from "../catalog/context";
import { useViewState } from "../ui/navigation";
import { explainTerm, type TermRef } from "../dex/glossary";
import { furnishings } from "./engine";
import {
  changeHomeKit,
  eligibleKits,
  explainGroup,
  homeEnvironment,
  moveResident,
  preferenceLabel,
  splitHomeByEnvironment,
  splitResident,
  swapHousemates,
} from "./recommend";
import type { HousematePlan, RecommendedHome } from "./types";
import { ExplainDialog, ItemButton, Modal, Portrait, SourceLink, TermChip } from "../ui/components";

export function HomeDetail({
  home,
  plan,
  onClose,
  onSave,
  tab = "Residents",
  onTabChange,
}: {
  home: RecommendedHome;
  plan: HousematePlan;
  onClose: () => void;
  onSave: (p: HousematePlan) => void;
  tab?: string;
  onTabChange: (tab: string) => void;
}) {
  const catalog = useCatalog();
  const kit = catalog.kits.find((k) => k.id === home.kitId);
  const residents = home.residents
    .map((id) => catalog.pokemon.find((p) => p.id === id)!)
    .filter(Boolean);
  const [resident, setResident] = useViewState(
    `planner.home.${home.id}.resident`,
    () => home.residents[0] || "",
  );
  const [to, setTo] = useState("");
  const [other, setOther] = useState("");
  const [error, setError] = useState("");
  const [term, setTerm] = useState<TermRef | null>(null);
  const residentId = home.residents.includes(resident)
    ? resident
    : home.residents[0] || "";
  const setup = furnishings(residents, catalog.items);
  const explanation = explainGroup(residents);
  const options = eligibleKits(home.residents.length, catalog);
  const sharedEnvironment = homeEnvironment(home, catalog);
  const environmentInfo = sharedEnvironment
    ? explainTerm({ kind: "environment", value: sharedEnvironment }, catalog.items)
    : null;
  if (!kit)
    return (
      <Modal title="Home details" onClose={onClose} wide>
        <p className="notice error" role="alert">
          This suggested home is no longer in the catalog. Choose a replacement
          or generate suggestions again.
        </p>
      </Modal>
    );
  return (
    <Modal title={kit.name} onClose={onClose} wide>
      <div className="home-detail-intro">
        <House size={22} />
        <span>
          {residents.length}/{kit.capacity} residents · {kit.width} ×{" "}
          {kit.depth} block footprint (reference)
        </span>
      </div>
      <p className="muted">
        Suggested for capacity, not confirmed affordability or unlock
        availability.
      </p>
      <div className="tabs">
        {["Residents", "Construction", "Furnishings", "Care", "Build sheet"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => onTabChange(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="home-detail-body">
        {tab === "Residents" && (
          <>
            <div className="resident-cards">
              {residents.map((p) => (
                <div className="resident-card" key={p.id}>
                  <Portrait pokemon={p} small />
                  <div>
                    <a href={`#/pokemon/${p.id}`}>{p.name} ↗</a>
                    <small className="resident-environment">
                      {p.environment ? (
                        <TermChip
                          term={{ kind: "environment", value: p.environment }}
                          onOpen={setTerm}
                        >
                          {p.environment}
                        </TermChip>
                      ) : (
                        "Environment unknown"
                      )}
                    </small>
                    <p>
                      {p.favorites.join(" · ") || "Preferences not recorded"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <h3>Why this group?</h3>
            <p>
              <strong>{preferenceLabel(explanation.match)}.</strong>{" "}
              {explanation.lines.join(" ")}
            </p>
            <details className="edit-home">
              <summary>Change housemates</summary>
              <label className="field">
                Resident
                <select
                  aria-label="Resident to move"
                  value={residentId}
                  onChange={(e) => setResident(e.target.value)}
                >
                  {residents.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Destination
                <select
                  aria-label="Destination home"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setOther("");
                  }}
                >
                  <option value="">Choose a home</option>
                  <option value="new">Split into a new group</option>
                  {plan.homes
                    .filter((h) => h.id !== home.id)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {catalog.kits.find((k) => k.id === h.kitId)?.name ||
                          h.id}{" "}
                        · {h.residents.length} residents
                      </option>
                    ))}
                </select>
              </label>
              {to && to !== "new" && (
                <label className="field">
                  Swap with
                  <select
                    aria-label="Swap with resident"
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                  >
                    <option value="">Move to a vacant slot</option>
                    {plan.homes
                      .find((h) => h.id === to)
                      ?.residents.map((id) => (
                        <option value={id} key={id}>
                          {catalog.pokemon.find((p) => p.id === id)!.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <button
                className="button secondary"
                disabled={!to || !residentId}
                onClick={() => {
                  try {
                    const next =
                      to === "new"
                        ? splitResident(plan, home.id, residentId, catalog)
                        : other
                          ? swapHousemates(
                              plan,
                              home.id,
                              to,
                              residentId,
                              other,
                              catalog,
                            )
                          : moveResident(
                              plan,
                              home.id,
                              to,
                              residentId,
                              catalog,
                            );
                    onSave(next);
                    setError("");
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Update housemates
              </button>
              {error && (
                <p role="alert" className="notice error">
                  {error}
                </p>
              )}
            </details>
          </>
        )}
        {tab === "Construction" && (
          <>
            <div className="info-grid">
              <div className="info-box">
                <span>Build time</span>
                <strong>{kit.buildTime || "Not recorded"}</strong>
              </div>
              <div className="info-box">
                <span>Construction helpers</span>
                <strong>{kit.helpers || "Not recorded"}</strong>
              </div>
              <div className="info-box">
                <span>Helper specialties</span>
                <strong>{kit.specialties.join(", ") || "Not recorded"}</strong>
              </div>
              <div className="info-box">
                <span>Building height</span>
                <strong>
                  {kit.height ? `${kit.height} blocks` : "Not recorded"}
                </strong>
              </div>
            </div>
            <h3>Construction materials</h3>
            {kit.materials.length ? (
              <ul className="supply-list">
                {kit.materials.map((m) => (
                  <li key={m.name}>
                    <ItemButton
                      name={m.name}
                      quantity={m.quantity}
                      context="home"
                      onOpen={setTerm}
                    />
                    <strong>× {m.quantity}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notice">
                Materials are not recorded. Check the building reference.
              </p>
            )}
            <p className="notice">
              Dimensions are reference information. Ground clearance, entrance
              access, unlocks and helper availability still need an in-game
              check.
            </p>
            <SourceLink url={kit.source} />
            <details className="edit-home">
              <summary>Change home</summary>
              <p className="muted">
                Only supported homes with enough capacity are listed.
                Construction requirements are shown before you choose.
              </p>
              <div className="kit-options">
                {options.map((option) => (
                  <div
                    className={`kit-option ${option.id === kit.id ? "selected" : ""}`}
                    key={option.id}
                  >
                    <label>
                      <input
                        type="radio"
                        name="replacement-home"
                        checked={option.id === kit.id}
                        onChange={() => {
                          try {
                            onSave(
                              changeHomeKit(plan, home.id, option.id, catalog),
                            );
                            setError("");
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      />
                      <div>
                        <strong>{option.name}</strong>
                        <small>
                          {option.width} × {option.depth} blocks ·{" "}
                          {option.capacity} residents · helpers{" "}
                          {option.helpers || "not recorded"}
                        </small>
                        {option.materials.length ? (
                          <small className="material-line">
                            {option.materials.map((m, i) => (
                              <span key={m.name}>
                                {i ? ", " : ""}
                                {m.quantity} ×{" "}
                                <ItemButton
                                  name={m.name}
                                  quantity={m.quantity}
                                  context="home"
                                  onOpen={setTerm}
                                />
                              </span>
                            ))}
                          </small>
                        ) : (
                          <small>Materials not recorded</small>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              {!options.length && (
                <p className="notice">
                  No supported home has enough capacity for this group.
                </p>
              )}
              {error && (
                <p role="alert" className="notice error">
                  {error}
                </p>
              )}
            </details>
          </>
        )}
        {tab === "Furnishings" && (
          <>
            <p className="muted">
              Planning suggestions matched to recorded favorite categories, not
              a verified minimum for every resident. Place items where residents
              can use them and check each Pokémon in-game.
            </p>
            {setup.selected.map(({ item, benefits, categories }) => (
              <div className="furnishing" key={item.id}>
                <Check size={18} />
                <div>
                  <strong>
                    1 × <ItemButton name={item.name} id={item.id} onOpen={setTerm} />
                  </strong>
                  <p>{categories.join(" · ")}</p>
                  <small>
                    Covers{" "}
                    {benefits
                      .map(
                        (id) => catalog.pokemon.find((p) => p.id === id)!.name,
                      )
                      .join(", ")}
                    : {categories.join(", ")}
                  </small>
                  <SourceLink url={item.source} />
                </div>
              </div>
            ))}
            {!!setup.uncovered.length && (
              <p className="notice">
                Still needs an item reference: {setup.uncovered.join(", ")}.
                These are not treated as satisfied.
              </p>
            )}
            {!setup.selected.length && !setup.uncovered.length && (
              <p className="notice">
                No furnishing suggestions: favorite categories are not recorded
                or no matching item is in the catalog.
              </p>
            )}
          </>
        )}
        {tab === "Care" && (
          <>
            {residents.map((p) => (
              <div className="care-row" key={p.id}>
                <strong>{p.name}</strong>
                <p>
                  Environment:{" "}
                  {p.environment ? (
                    <TermChip
                      term={{ kind: "environment", value: p.environment }}
                      onOpen={setTerm}
                    >
                      {p.environment}
                    </TermChip>
                  ) : (
                    "Unknown"
                  )}{" "}
                  · Food: {p.food || "Unknown"}
                </p>
              </div>
            ))}
            <h3>Environment setup</h3>
            {explanation.match === "different" ? (
              <div className="notice">
                <p>
                  This home records more than one ideal environment
                  {explanation.environments.length
                    ? ` (${explanation.environments.join(", ")})`
                    : ""}
                  . One space cannot hold both conditions at once.
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    try {
                      onSave(splitHomeByEnvironment(plan, home.id, catalog));
                      setError("");
                      onClose();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Split by environment
                </button>
              </div>
            ) : environmentInfo ? (
              <div className="environment-setup">
                <p className="muted">
                  App guidance, not a recorded requirement.
                </p>
                {environmentInfo.achieve && <p>{environmentInfo.achieve}</p>}
                {!!environmentInfo.items.length && (
                  <ul className="supply-list environment-items">
                    {environmentInfo.items.map((item) => (
                      <li key={item.id}>
                        <ItemButton
                          name={item.name}
                          id={item.id}
                          onOpen={setTerm}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="notice">
                Environment is not recorded for this group, so app guidance is
                not available.
              </p>
            )}
            <p className="notice">
              Food is ongoing care, listed separately from construction
              materials and environment guidance. Item reach and floor
              coverage are not simulated.
            </p>
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
          </>
        )}
        {tab === "Build sheet" && (
          <>
            <p className="muted">
              Everything suggested for this home in one place: recorded
              construction requirements, plus app guidance for furnishings,
              environment and food. Not a substitute for an in-game check.
            </p>
            <h3>Home</h3>
            <p>
              {kit.name} · {residents.length}/{kit.capacity} residents ·{" "}
              {kit.buildTime || "build time not recorded"}
            </p>
            {kit.materials.length ? (
              <ul className="supply-list">
                {kit.materials.map((m) => (
                  <li key={m.name}>
                    <ItemButton
                      name={m.name}
                      quantity={m.quantity}
                      context="home"
                      onOpen={setTerm}
                    />
                    <strong>× {m.quantity}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notice">Materials are not recorded.</p>
            )}
            <h3>Furnishings (suggested)</h3>
            {setup.selected.length ? (
              setup.selected.map(({ item, categories }) => (
                <p key={item.id}>
                  1 × <ItemButton name={item.name} id={item.id} onOpen={setTerm} />{" "}
                  — {categories.join(", ")}
                </p>
              ))
            ) : (
              <p className="notice">No furnishing suggestions.</p>
            )}
            <h3>Environment (app guidance)</h3>
            {environmentInfo ? (
              <p>
                {sharedEnvironment}:{" "}
                {environmentInfo.items.length
                  ? environmentInfo.items.map((i, index) => (
                      <span key={i.id}>
                        {index ? ", " : ""}
                        <ItemButton name={i.name} id={i.id} onOpen={setTerm} />
                      </span>
                    ))
                  : "no example items recorded"}
              </p>
            ) : (
              <p className="notice">
                {explanation.match === "different"
                  ? "Mixed environments recorded; split this home for guidance."
                  : "Environment is not recorded for this group."}
              </p>
            )}
            <h3>Food (per resident)</h3>
            {residents.map((p) => (
              <p key={p.id}>
                {p.name}: {p.food || "Not recorded"}
              </p>
            ))}
          </>
        )}
      </div>
      {term && <ExplainDialog term={term} onClose={() => setTerm(null)} />}
    </Modal>
  );
}

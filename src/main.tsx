import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CatalogContext } from "./catalog/context";
import type { Catalog } from "./catalog/types";
import { ProgressProvider } from "./progress/context";
import { StorageProvider } from "./storage/context";
import { ScanSessionProvider } from "./storage/scanSession";
import "./styles.css";
function Root() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/data/catalog.json")
      .then((r) => {
        if (!r.ok) throw Error("Reference data could not be loaded.");
        return r.json();
      })
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);
  if (error)
    return (
      <div className="loading">
        <h1>Notebook unavailable</h1>
        <p>{error}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>
    );
  if (!catalog) return <div className="loading">Gathering the fieldnotes…</div>;
  return (
    <CatalogContext.Provider value={catalog}>
      <ProgressProvider>
        <StorageProvider>
          <ScanSessionProvider>
            <App />
          </ScanSessionProvider>
        </StorageProvider>
      </ProgressProvider>
    </CatalogContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

if (
  import.meta.env.PROD &&
  import.meta.env.VITE_DISTRIBUTION === "web" &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Core app and local saves remain usable without offline caching. */
    });
  });
}

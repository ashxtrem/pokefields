import { createContext, useContext } from "react";
import type { Catalog } from "./types";
export const CatalogContext = createContext<Catalog | null>(null);
export function useCatalog() {
  const c = useContext(CatalogContext);
  if (!c) throw Error("Catalog not loaded");
  return c;
}

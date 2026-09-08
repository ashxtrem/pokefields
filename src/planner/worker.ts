import { generatePlan } from "./engine";
import type { Catalog } from "../catalog/types";
import type { PlannerInput } from "./types";
self.onmessage = (
  e: MessageEvent<{ input: PlannerInput; catalog: Catalog }>,
) => {
  try {
    self.postMessage({ plan: generatePlan(e.data.input, e.data.catalog) });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Unable to generate plan.",
    });
  }
};

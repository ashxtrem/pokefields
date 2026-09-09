import { useState } from "react";
import { useCatalog } from "../catalog/context";
import { itemImageUrl, resolveItem } from "../dex/glossary";
export function SupplyIcon({ label }: { label: string }) {
  const { items } = useCatalog();
  const item = resolveItem(label.replace(/^Total /, ""), items);
  const [failed, setFailed] = useState(false);
  return (
    <span className="supply-icon" aria-hidden="true">
      {item && !failed ? (
        <img
          src={itemImageUrl(item.id)}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        label.replace(/^Total /, "").slice(0, 1)
      )}
    </span>
  );
}

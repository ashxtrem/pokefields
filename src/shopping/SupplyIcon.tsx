import { useState } from "react";
import { useCatalog } from "../catalog/context";
import { itemImageUrl, resolveItem } from "../dex/glossary";
export function SupplyIcon({
  label,
  itemId,
}: {
  label: string;
  itemId?: string;
}) {
  const { items } = useCatalog();
  const item = itemId
    ? items.find((row) => row.id === itemId) || resolveItem(label, items)
    : resolveItem(label.replace(/^Total /, ""), items);
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

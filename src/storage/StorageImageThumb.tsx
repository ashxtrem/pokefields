import { useEffect, useState } from "react";
import { Modal } from "../ui/components";
import { getImage } from "./db";
import { imageObjectUrl, revokeImageObjectUrl } from "./images";

/**
 * Loads a StorageImage row by id and renders it as an <img>, managing its object URL lifecycle.
 * With `zoomable`, wraps it in a button that opens a full-size lightbox — kept off by default
 * since a card thumbnail nested inside an `<a>` (see StoragePage.tsx's chest list) can't also be
 * its own button without creating invalid nested interactive elements.
 */
export function StorageImageThumb({
  imageId,
  alt,
  className,
  zoomable = false,
}: {
  imageId: string | undefined;
  alt: string;
  className?: string;
  zoomable?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    if (imageId) {
      getImage(imageId).then((image) => {
        if (cancelled || !image) return;
        objectUrl = imageObjectUrl(image);
        setUrl(objectUrl);
      });
    }
    return () => {
      cancelled = true;
      if (objectUrl) revokeImageObjectUrl(objectUrl);
    };
  }, [imageId]);

  if (!imageId || !url) return null;

  const img = <img className={className} src={url} alt={alt} loading="lazy" decoding="async" />;
  if (!zoomable) return img;

  return (
    <>
      <button
        type="button"
        className="storage-image-zoom-trigger"
        aria-label={`View full size${alt ? `: ${alt}` : ""}`}
        onClick={() => setZoomed(true)}
      >
        {img}
      </button>
      {zoomed ? (
        <Modal title={alt || "Photo"} onClose={() => setZoomed(false)} wide>
          <img className="storage-image-lightbox" src={url} alt={alt} />
        </Modal>
      ) : null}
    </>
  );
}

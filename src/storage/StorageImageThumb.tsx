import { useEffect, useState } from "react";
import { getImage } from "./db";
import { imageObjectUrl, revokeImageObjectUrl } from "./images";

/** Loads a StorageImage row by id and renders it as an <img>, managing its object URL lifecycle. */
export function StorageImageThumb({
  imageId,
  alt,
  className,
}: {
  imageId: string | undefined;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

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
  return <img className={className} src={url} alt={alt} loading="lazy" decoding="async" />;
}

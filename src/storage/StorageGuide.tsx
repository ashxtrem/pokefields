import { useState, type ReactNode } from "react";
import { Modal } from "../ui/components";
import { CHEST_TYPE_LABEL } from "./ChestForm";
import stepWelcome from "./guide/01-welcome.png";
import stepCreateChest from "./guide/02-create-chest.png";
import stepAddItems from "./guide/03-add-items.png";
import stepCapture from "./guide/04-capture.png";
import stepLocation from "./guide/05-location.png";
import stepReview from "./guide/06-review.png";
import stepSearch from "./guide/07-search.png";

const SEEN_KEY = "pkm.storage.guideSeen";
const SHOW_EXTERNAL_HELP = import.meta.env.VITE_DISTRIBUTION === "web";

/** Device-local, one-time-ever flag — mirrors the try/catch storage pattern used throughout the
 * app (e.g. src/ui/navigation.ts's sessionStorage reads) since storage can be missing or blocked. */
export function hasSeenStorageGuide(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markStorageGuideSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* localStorage can be missing or blocked */
  }
}

interface GuideStep {
  title: string;
  image: string;
  imageAlt: string;
  body: ReactNode;
}

const STEPS: GuideStep[] = [
  {
    title: "What Storage is",
    image: stepWelcome,
    imageAlt: "The empty Storage page, with search and a New chest action",
    body: (
      <p>
        Record where a chest is and what's in it. Storage tracks presence, not quantity — it
        never claims an item is still there, only where you last recorded it.
      </p>
    ),
  },
  {
    title: "Create a chest",
    image: stepCreateChest,
    imageAlt: "The new chest form, showing region, name, and chest type fields",
    body: (
      <>
        <p>Pick a region, give it a name, and choose a type:</p>
        <ul>
          <li>{CHEST_TYPE_LABEL["storage-box"]}</li>
          <li>{CHEST_TYPE_LABEL["big-storage-box"]}</li>
        </ul>
        <p>
          Add a photo of where the chest is in-game so you can find it again later — this is
          separate from the screenshots you'll scan for contents.
        </p>
      </>
    ),
  },
  {
    title: "Add contents two ways",
    image: stepAddItems,
    imageAlt: "Searching the catalog and saved items to add to a chest",
    body: (
      <p>
        Search and add items by hand, or scan a screenshot of the open box. A missing DLC item can
        be saved as your own local item and reused later — it stays searchable even though it's
        not in the official catalog.
      </p>
    ),
  },
  {
    title: "Getting a screenshot that works",
    image: stepCapture,
    imageAlt: "The screenshot import screen, with one page-upload slot per chest page",
    body: (
      <ul>
        <li>
          Capture it with the Capture Button on Joy-Con 2 (L)
          {SHOW_EXTERNAL_HELP ? (
            <>
              {" — "}
              <a
                href="https://www.nintendo.com/en-gb/Support/Nintendo-Switch-2/How-to-Capture-and-View-Screenshots-on-Nintendo-Switch-2-2909826.html"
                target="_blank"
                rel="noreferrer"
              >
                Nintendo's capture guide ↗
              </a>
            </>
          ) : null}
          .
        </li>
        <li>Phone photos of the screen aren't supported and won't scan reliably — screenshot only.</li>
        <li>
          Turn off the on-screen info display before capturing so nothing overlaps the items, and
          keep the game's focus on the bag rather than a paused menu.
        </li>
        <li>
          One screenshot is required for a Storage box. A Big storage box has three pages — scan
          what you have now and add the rest later.
        </li>
      </ul>
    ),
  },
  {
    title: "Find the box again in-game",
    image: stepLocation,
    imageAlt: "A chest card showing its location photo and note",
    body: (
      <p>
        The location photo you added covers the room. For faster identification without opening
        every box, try hanging a wall frame with one representative item above each box
        {SHOW_EXTERNAL_HELP ? (
          <>
            {" — "}
            <a
              href="https://pokopia.center/posts/pokopia-storage-organization-guide-2026/"
              target="_blank"
              rel="noreferrer"
            >
              Pokopia Center's storage guide ↗
            </a>
          </>
        ) : null}
        .
      </p>
    ),
  },
  {
    title: "You always review before anything is saved",
    image: stepReview,
    imageAlt: "The scan review screen, showing a proposed match and an unresolved slot",
    body: (
      <p>
        Every scanned match is a proposal you confirm or correct — nothing is saved automatically.
        Anything the scanner isn't confident about is kept aside for you to identify later, never
        guessed.
      </p>
    ),
  },
  {
    title: "Search anytime",
    image: stepSearch,
    imageAlt: "Storage search results showing a matching chest",
    body: (
      <p>
        Search from Storage's own search box, or from "Find in storage" on any item's page in
        Items. Reopen this guide anytime from the Guide button on this page.
      </p>
    ),
  },
];

export function StorageGuide({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <Modal title="Storage guide" onClose={onClose} sheet wide>
      <div className="storage-guide">
        <img className="storage-guide-image" src={current.image} alt={current.imageAlt} />
        <h3>{current.title}</h3>
        <div className="storage-guide-body">{current.body}</div>
        <div className="storage-guide-dots" role="tablist" aria-label="Guide steps">
          {STEPS.map((guideStep, index) => (
            <button
              key={guideStep.title}
              type="button"
              role="tab"
              aria-selected={index === step}
              aria-label={`Step ${index + 1} of ${STEPS.length}: ${guideStep.title}`}
              className={`storage-guide-dot${index === step ? " active" : ""}`}
              onClick={() => setStep(index)}
            />
          ))}
        </div>
        <div className="button-row">
          {!isFirst && (
            <button type="button" className="button secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          {!isLast ? (
            <button type="button" className="button" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="button" onClick={onClose}>
              Got it
            </button>
          )}
          {!isLast && (
            <button type="button" className="text-button" onClick={onClose}>
              Skip guide
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

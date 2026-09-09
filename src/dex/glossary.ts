import type { Item } from "../catalog/types";

export type TermKind =
  | "environment"
  | "specialty"
  | "favorite"
  | "food"
  | "item"
  | "area"
  | "time"
  | "weather"
  | "rarity"
  | "content"
  | "condition"
  | "habitat";

export interface TermRef {
  kind: TermKind;
  value: string;
  quantity?: string;
  label?: string;
  id?: string;
}

export interface ExplainedItem {
  id: string;
  name: string;
  image: string;
  categories: string[];
  source?: string;
  locations?: string[];
  recipe?: { name: string; quantity: number }[];
  recipeLocation?: string | null;
  event?: string | null;
}

export interface TermExplanation {
  title: string;
  kindLabel: string;
  meaning: string;
  achieve?: string;
  obtain?: string[];
  items: ExplainedItem[];
  categories?: string[];
  source?: string;
  quantity?: string;
  heroImage?: string;
}

export function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function pokemonArtUrl(nationalNumber: number, small = false) {
  return small
    ? `/images/pokemon/sprites/${nationalNumber}.png`
    : `/images/pokemon/${nationalNumber}.png`;
}

export function itemImageUrl(id: string) {
  return `/images/items/${id}.png`;
}

export function specialtyImageUrl(value: string) {
  const id = slug(value);
  return id ? `/images/specialties/${id}.png` : null;
}

export function habitatImageUrl(image: string | null) {
  if (!image) return null;
  try {
    const name = new URL(image, "https://www.serebii.net").pathname
      .split("/")
      .pop();
    if (!name || !/\.png$/i.test(name)) return null;
    return `/images/habitats/${name}`;
  } catch {
    return null;
  }
}

export function contentLabel(event?: string | null, contentSource?: string) {
  if (event) return event;
  if (contentSource === "expansion-pass") return "Bubbly Basin expansion";
  if (contentSource === "event") return "Event";
  if (!contentSource || contentSource === "base") return "Base game";
  return contentSource;
}

export function foodEntries(food: string | null) {
  if (!food) return [];
  return food
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const flavor = flavorKey(part);
      const gender = part.match(/^(Male|Female)\s*:/i)?.[1];
      const label = flavor
        ? gender
          ? `${gender}: ${flavor}`
          : `${flavor} flavors`
        : part;
      return { flavor: flavor || part, label };
    });
}

export function parseRequirement(raw: string) {
  const text = raw.replace(/\s+/g, " ").trim();
  const match = text.match(/^(?:(\d+)\s*)?×\s*(.+)$/);
  const quantity = match?.[1];
  const name = (match?.[2] || text).trim();
  return { quantity, name, kind: requirementKind(name) };
}

function flavorKey(value: string) {
  const match = value.match(/\b(Sweet|Sour|Spicy|Bitter|Dry)\b/i);
  return match
    ? match[1][0].toUpperCase() + match[1].slice(1).toLowerCase()
    : null;
}

function namedItem(id: string, name: string, items: Item[]): ExplainedItem {
  const hit =
    items.find((item) => item.id === id) ||
    items.find((item) => slug(item.name) === id);
  return explainedFrom(hit, id, name);
}

export function resolveItem(name: string, items: Item[]): ExplainedItem {
  const stripped = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const full = slug(name);
  const short = slug(stripped);
  const hit =
    items.find((item) => item.id === full || item.id === short) ||
    items.find((item) => slug(item.name) === full || slug(item.name) === short) ||
    items.find(
      (item) =>
        short.length > 3 &&
        (slug(item.name).startsWith(short) || short.startsWith(slug(item.name))),
    );
  return explainedFrom(hit, hit?.id || short || full, hit?.name || stripped || name);
}

function explainedFrom(
  hit: Item | undefined,
  id: string,
  name: string,
): ExplainedItem {
  return {
    id: hit?.id || id,
    name: hit?.name || name,
    image: itemImageUrl(hit?.id || id),
    categories: hit?.categories || [],
    source: hit?.source,
    locations: hit?.locations,
    recipe: hit?.recipe,
    recipeLocation: hit?.recipeLocation,
    event: hit?.event,
  };
}

export function itemObtain(item: ExplainedItem): string[] {
  const lines = [...(item.locations || [])];
  if (item.recipe?.length) {
    const craft = item.recipe
      .map((part) => `${part.quantity} × ${part.name}`)
      .join(", ");
    const idx = lines.findIndex((line) => /craft from recipe/i.test(line));
    if (idx >= 0) lines[idx] = `Craft from: ${craft}`;
    else if (!lines.some((line) => /^craft from:/i.test(line)))
      lines.push(`Craft from: ${craft}`);
  }
  if (item.recipeLocation && !lines.some((line) => line === item.recipeLocation))
    lines.push(`Recipe unlocked: ${item.recipeLocation}`);
  if (item.event && !lines.some((line) => line.includes(item.event!)))
    lines.push(`Event: ${item.event}`);
  return lines;
}

const KIND_LABELS: Record<TermKind, string> = {
  environment: "Ideal environment",
  specialty: "Specialty",
  favorite: "Favorite furnishings",
  food: "Favorite food",
  item: "Item",
  area: "Island area",
  time: "Time of day",
  weather: "Weather",
  rarity: "Spawn rarity",
  content: "Where it comes from",
  condition: "Build condition",
  habitat: "Attracting habitat",
};

export const ENVIRONMENT_VALUES = [
  "Bright",
  "Dark",
  "Warm",
  "Cool",
  "Humid",
  "Dry",
] as const;

export function environmentGuidance(value: string) {
  return ENVIRONMENTS[value] || null;
}

export function environmentExampleIds(value: string) {
  return (ENVIRONMENTS[value]?.examples || []).map(([id]) => id);
}

export function allEnvironmentExampleIds() {
  return [
    ...new Set(
      Object.values(ENVIRONMENTS).flatMap((entry) =>
        entry.examples.map(([id]) => id),
      ),
    ),
  ];
}

const ENVIRONMENTS: Record<string, { meaning: string; achieve: string; examples: [string, string][] }> =
  {
    Bright: {
      meaning:
        "This Pokémon is happiest in a well-lit space. Bright is about lamps and other light sources, not sunny weather.",
      achieve:
        "Place lights inside a home or habitat: lamps, desk lights, TVs, streetlights, or other electric fixtures. A Generate Pokémon can power electric lights. Indoor rooms make brightness easier to control than open outdoor habitats.",
      examples: [
        ["desklight", "Desk light"],
        ["television", "Television"],
        ["plainlamp", "Plain lamp"],
        ["mushroomstreetlight", "Mushroom streetlight"],
        ["pokeballlight", "Poké Ball light"],
      ],
    },
    Dark: {
      meaning:
        "This Pokémon prefers a dim or lightless space, closer to a cave than a lit room.",
      achieve:
        "Use a covered house or den with few windows and keep lamps, TVs, and streetlights out of the comfort zone. Dark flooring and cave-like furnishings help the mood; outdoor habitats are harder to keep dark because you cannot fully control light.",
      examples: [
        ["gravestone", "Gravestone"],
        ["stonehousekit", "Stone house kit"],
        ["sanddenkit", "Sand den kit"],
        ["stalagmites", "Stalagmites"],
      ],
    },
    Warm: {
      meaning:
        "This Pokémon likes heat. Warmth comes from fire, enclosed rooms, and heat-giving furnishings.",
      achieve:
        "Place campfires, bonfires, torches, fireplaces, or candles near the home. A Castform weather charm set for sun can support a warmer, drier feel. Indoor rooms hold heat better; rain and open water work against it.",
      examples: [
        ["bonfire", "Bonfire"],
        ["campfire", "Campfire"],
        ["torch", "Torch"],
        ["stonefireplace", "Stone fireplace"],
        ["castformweathercharm", "Castform weather charm"],
      ],
    },
    Cool: {
      meaning:
        "This Pokémon likes a colder space. Keep heat sources away and add ice or cooling items.",
      achieve:
        "Place ice, Icy Rock, or a cooler, and avoid campfires and other heat items in the same zone. Ice can be found in cold cave spots such as behind the waterfall in Palette Town. Enclosed rooms hold a cool setup more reliably than outdoors.",
      examples: [
        ["icyrock", "Icy Rock"],
        ["cooler", "Cooler"],
        ["shavedice", "Shaved ice"],
        ["freezingchamberskit", "Freezing Chambers kit"],
      ],
    },
    Humid: {
      meaning:
        "This Pokémon likes moist air and greenery. Humidity comes from water, rain, and plants.",
      achieve:
        "Add water basins, fountains, sprinklers, humidifiers, and lots of plants or flowers. Rain weather and Water-specialty help. Keep fire and drying items out of this zone so the moisture is not cancelled out.",
      examples: [
        ["waterbasin", "Water basin"],
        ["humidifier", "Humidifier"],
        ["horseafountain", "Horsea fountain"],
        ["twistedpottedplant", "Twisted potted plant"],
        ["leafyplant", "Leafy plant"],
      ],
    },
    Dry: {
      meaning:
        "This Pokémon likes low moisture: sand, cave, or covered spaces rather than rain and water features.",
      achieve:
        "Build under a roof, keep grass and water features away, and add fire, sand, or Smooth Rock to dry the zone. Sunny weather helps. Dark and dry setups often work in the same covered house.",
      examples: [
        ["smoothrock", "Smooth Rock"],
        ["bonfire", "Bonfire"],
        ["sandbox", "Sandbox"],
        ["heatrock", "Heat Rock"],
      ],
    },
  };

const SPECIALTIES: Record<string, { meaning: string; achieve?: string }> = {
  Appraise: {
    meaning: "Professor Tangrowth can identify lost relics you have found.",
    achieve: "Bring lost relics to Professor Tangrowth and ask for an appraisal.",
  },
  Build: {
    meaning: "A Build Pokémon leads construction so kits can actually go up.",
    achieve:
      "Assign a Build Pokémon as the leader when you start a building or remodel. Without one, most kits cannot be built.",
  },
  Bulldoze: {
    meaning: "Leads demolition, rebuilding, and relocation jobs, including Pokémon Center work.",
    achieve: "Ask a Bulldoze Pokémon to take charge when you demolish, move, or rebuild a structure.",
  },
  Burn: {
    meaning:
      "Lights flammable objects, runs smelting furnaces, and can bake Squishy Clay into Brick.",
    achieve:
      "Have them follow you near candles, campfires, or furnaces, or show them Squishy Clay. They also help light some habitats.",
  },
  Chop: {
    meaning: "Turns small logs into lumber.",
    achieve: "Show a Chop Pokémon a small log, or station them where logs are processed.",
  },
  Collect: {
    meaning: "Trades rare odds and ends for appraised relics or rare feathers.",
    achieve: "Give them an appraised lost relic, Rainbow Feather, or Silver Feather and see what they offer back.",
  },
  Crush: {
    meaning: "Mashes materials into other goods, such as berries into paint or limestone into concrete.",
    achieve: "Show them the raw material at the right station, such as a concrete mixer for limestone.",
  },
  DJ: {
    meaning: "DJ Rotom can play music CDs you have found.",
    achieve: "Ask DJ Rotom to play a CD when you want music in the area.",
  },
  "Dream Island": {
    meaning: "Can take you to a Dream Island.",
    achieve: "Ask a Dream Island Pokémon (with a Poké Doll) to transport you there.",
  },
  Eat: {
    meaning: "Mosslax may give you something good in return for food.",
    achieve: "Offer food to Mosslax and see what they trade back.",
  },
  Engineer: {
    meaning: "Leads huge builds and can shorten construction time on some late-game kits.",
    achieve: "Put Tinkmaster in charge of a large building job when the kit calls for an engineer.",
  },
  Explode: {
    meaning: "Can be fired from a cannon to clear a wide blast on impact.",
    achieve: "Use a cannon with an Explode Pokémon when you need to destroy a large obstacle.",
  },
  Fly: {
    meaning: "Can fly you to another Pokémon you are searching for in the same area.",
    achieve: "Use Pokédex search, then ask a Fly Pokémon to take you to that friend.",
  },
  Gather: {
    meaning: "Picks up loose items and drops them in a community box.",
    achieve: "Keep a Gather Pokémon near a community box, or let them follow you while you explore.",
  },
  "Gather Honey": {
    meaning: "Will trade special furniture if you bring them honey.",
    achieve: "Give honey to a Gather Honey Pokémon such as Vespiquen.",
  },
  Generate: {
    meaning: "Powers electric machines, lamps, and appliances.",
    achieve: "Station them next to the machine or light that needs power, or have them follow you to it.",
  },
  Grow: {
    meaning: "Helps nearby plants, crops, flowers, and trees mature faster.",
    achieve: "Walk them to planted crops or leave them beside a garden you want to speed up.",
  },
  Hype: {
    meaning: "Starts dancing when music is playing and lifts the local mood.",
    achieve: "Play music nearby, then let a Hype Pokémon dance in that area.",
  },
  Illuminate: {
    meaning: "Peakychu can light up the whole town from a charging station.",
    achieve: "Take Peakychu to a charging station when you want the area brighter.",
  },
  Litter: {
    meaning: "Drops useful materials near their home as they live there.",
    achieve: "Give them a home and check around it for fluff, rope, honey, clay, and similar scraps.",
  },
  Paint: {
    meaning: "Smearguru can recolor certain furniture and items.",
    achieve: "Show them a paintable item when you want a new color or pattern.",
  },
  Party: {
    meaning: "Chef Dente helps prepare larger batches of party food.",
    achieve: "Ask Chef Dente when you are cooking for a gathering.",
  },
  Rarify: {
    meaning: "Turns Star Pieces into rare Pokémetal.",
    achieve: "Craft Star Pieces from stardust, then show them to a Rarify Pokémon such as Porygon-Z.",
  },
  Recycle: {
    meaning: "Turns nonburnable garbage into iron ore and wastepaper into paper.",
    achieve: "Show them the junk at a recycling spot and collect the processed materials.",
  },
  Scrub: {
    meaning: "Cleans grubby pearls into shiny pearls, and can tidy a Pokémon you meet while following you.",
    achieve: "Give them a grubby pearl, or let them follow you when you want an encounter cleaned up.",
  },
  Search: {
    meaning: "Helps you find buried items.",
    achieve: "Ask them to help when you are digging or using a dowsing machine.",
  },
  Storage: {
    meaning: "Can hold extra items for you, like a walking storage box.",
    achieve: "Ask a Storage Pokémon such as Gulpin to keep items when your bags are full.",
  },
  Teleport: {
    meaning: "Instantly takes you to another Pokémon you are searching for.",
    achieve: "Search in the Pokédex, then ask a Teleport Pokémon to jump you there.",
  },
  Trade: {
    meaning: "Can run a shop desk and exchange items with you at a cash register.",
    achieve: "Station them at a Poké Mart or Pokémon Center counter to trade.",
  },
  Transform: {
    meaning: "Ditto can copy other Pokémon and pick up more of their moves that way.",
    achieve: "Use Transform when you want Ditto to learn from a Pokémon you are with.",
  },
  Water: {
    meaning: "Uses a filled water basin to spray nearby fields and plants, and can wet muddy spots.",
    achieve: "Fill a water basin, then ask them to water crops or clean mud.",
  },
  Yawn: {
    meaning: "Can tell you how humid the area currently is.",
    achieve: "Ask Slowpoke when you are tuning a humid or dry home and need a reading.",
  },
  "???": {
    meaning: "This specialty is not fully recorded in the reference notes yet.",
  },
};

const FAVORITES: Record<string, { meaning: string; achieve: string }> = {
  "Blocky stuff": {
    meaning: "Boxy, cubic furnishings and toys.",
    achieve: "Place cubes, blocks, or other square-shaped objects in the home’s comfort zone.",
  },
  Cleanliness: {
    meaning: "Tidy, washing, and cleaning objects.",
    achieve: "Add sinks, washing machines, cleaning supplies, or other neat household fixtures.",
  },
  "Colorful stuff": {
    meaning: "Bright, painted, or multicolored decorations.",
    achieve: "Use colorful furniture, paint, posters, or rainbow-like objects nearby.",
  },
  "Complicated stuff": {
    meaning: "Busy machines or intricate gadgets.",
    achieve: "Place electronics, lab gear, or other detailed devices in the space.",
  },
  Construction: {
    meaning: "Building-site tools and materials.",
    achieve: "Add cones, beams, tools, or other construction props to the home.",
  },
  Containers: {
    meaning: "Boxes, barrels, chests, and other things that hold stuff.",
    achieve: "Place storage boxes, barrels, or chests where the Pokémon lives.",
  },
  "Cute stuff": {
    meaning: "Soft, round, or adorable decorations.",
    achieve: "Add dolls, cute furniture sets, or other charming objects.",
  },
  Electronics: {
    meaning: "Screens, computers, and powered gadgets.",
    achieve: "Place TVs, PCs, phones, or other electronics in the comfort zone. Some need a Generate Pokémon.",
  },
  Exercise: {
    meaning: "Sporty or workout objects.",
    achieve: "Add punching bags, bikes, slides, or other active play equipment.",
  },
  Fabric: {
    meaning: "Cloth, cushions, and soft textiles.",
    achieve: "Place rugs, sofas, curtains, or knitting supplies nearby.",
  },
  Garbage: {
    meaning: "Trash, recycling, and messy junk piles.",
    achieve: "Add bins, garbage bags, or other refuse props to the space.",
  },
  Gatherings: {
    meaning: "Party and group hangout objects.",
    achieve: "Use party cups, stages, balloons, or other gathering decorations.",
  },
  "Glass stuff": {
    meaning: "Clear, shiny, or glassy objects.",
    achieve: "Place windows, glass furniture, bottles, or other see-through pieces.",
  },
  "Group activities": {
    meaning: "Things meant to be used together, not solo toys.",
    achieve: "Add benches, stages, sports sets, or other shared-activity furnishings.",
  },
  "Hard stuff": {
    meaning: "Solid, rigid materials rather than cushions.",
    achieve: "Use stone, metal, or other firm furnishings in the home.",
  },
  Healing: {
    meaning: "Care, first aid, and recovery objects.",
    achieve: "Place first-aid kits, Pokémon Center pieces, or other healing props.",
  },
  "Letters and words": {
    meaning: "Writing, signs, and printed words.",
    achieve: "Add letters, books, signs, or corkboards to the space.",
  },
  "Looks like food": {
    meaning: "Objects that resemble meals or ingredients.",
    achieve: "Place food-shaped decorations or dining displays nearby.",
  },
  "Lots of dirt": {
    meaning: "Soil, mud, and earthy ground cover.",
    achieve: "Use dirt, sand, farm soil, or other earthy tiles and props.",
  },
  "Lots of fire": {
    meaning: "Flames, hearths, and heat sources.",
    achieve: "Place campfires, torches, fireplaces, or other fire furnishings. A Burn Pokémon can light them.",
  },
  "Lots of nature": {
    meaning: "Plants, trees, and garden greenery.",
    achieve: "Fill the comfort zone with potted plants, flowers, trees, or garden kits.",
  },
  "Lots of water": {
    meaning: "Ponds, basins, and watery décor.",
    achieve: "Add fountains, basins, boats, or other water features. This also raises humidity.",
  },
  Luxury: {
    meaning: "Fancy, expensive-looking furnishings.",
    achieve: "Use luxury furniture sets, jewelry, or ornate décor.",
  },
  "Metal stuff": {
    meaning: "Iron, steel, and other metal objects.",
    achieve: "Place iron furniture, pipes, or metal décor in the home.",
  },
  "Nice breezes": {
    meaning: "Airy objects that suggest wind.",
    achieve: "Add fans, pinwheels, windmills, or other breeze-making pieces.",
  },
  "Noisy stuff": {
    meaning: "Instruments, speakers, and loud objects.",
    achieve: "Place mics, speakers, drums, or other noisy furnishings.",
  },
  None: {
    meaning: "No favorite furnishing category is recorded for this Pokémon.",
    achieve: "Furnish from their environment and food notes instead, and treat this as unknown rather than a dislike.",
  },
  "Ocean vibes": {
    meaning: "Beach, sea, and coastal objects.",
    achieve: "Use shells, marine furniture, boats, or other seaside pieces.",
  },
  "Play spaces": {
    meaning: "Playgrounds and toys meant for play, not just display.",
    achieve: "Add slides, sandboxes, toys, or other play equipment.",
  },
  "Pretty flowers": {
    meaning: "Flowering plants and floral arrangements.",
    achieve: "Plant flowers or place floral pots and garden ornaments nearby.",
  },
  Rides: {
    meaning: "Things you sit on and move, such as bikes or boats.",
    achieve: "Place bikes, boats, or other rideable objects in the space.",
  },
  "Round stuff": {
    meaning: "Circles, spheres, and rounded shapes.",
    achieve: "Use round rugs, balls, stools, or other curved objects.",
  },
  "Sharp stuff": {
    meaning: "Pointed or angular objects.",
    achieve: "Place pointed décor, tools, or other sharp-looking furnishings.",
  },
  "Shiny stuff": {
    meaning: "Glossy, reflective, or glittering objects.",
    achieve: "Add mirrors, jewelry, metals, or other shiny pieces.",
  },
  "Slender objects": {
    meaning: "Tall, thin furnishings rather than bulky ones.",
    achieve: "Use slim candles, poles, or other skinny objects.",
  },
  "Soft stuff": {
    meaning: "Cushions, fluff, and squashy furnishings.",
    achieve: "Place beds, sofas, fluff, or other soft pieces in the comfort zone.",
  },
  "Spinning stuff": {
    meaning: "Objects that turn or look like they spin.",
    achieve: "Add pinwheels, records, or other spinning decorations.",
  },
  "Spooky stuff": {
    meaning: "Eerie, ghostly, or grave-like objects.",
    achieve: "Use gravestones, eerie candles, or other spooky décor.",
  },
  "Stone stuff": {
    meaning: "Rock, stone, and masonry.",
    achieve: "Place stone furniture, boulders, or rock tiles nearby.",
  },
  "Strange stuff": {
    meaning: "Odd or mysterious objects that do not fit a simple theme.",
    achieve: "Add unusual gadgets, relics, or other peculiar decorations.",
  },
  Symbols: {
    meaning: "Emblems, signs, and iconic marks.",
    achieve: "Place badges, emblems, or symbol-like decorations in the home.",
  },
  "Watching stuff": {
    meaning: "Screens and things meant to be looked at.",
    achieve: "Add TVs, monitors, or other viewing objects.",
  },
  "Wobbly stuff": {
    meaning: "Unsteady or jiggly objects.",
    achieve: "Place wobblers, jelly-like toys, or other unstable-looking pieces.",
  },
  "Wooden stuff": {
    meaning: "Wood furniture and timber props.",
    achieve: "Use wooden tables, logs, crates, or other timber furnishings.",
  },
};

const FOOD: Record<string, { meaning: string; achieve: string; examples: [string, string][] }> = {
  Sweet: {
    meaning: "This Pokémon prefers sweet-tasting food. Matching flavor raises comfy level and your bond.",
    achieve: "Offer sweet berries and dishes such as Pecha Berry, fluffy bread, or watermelon treats.",
    examples: [
      ["pechaberry", "Pecha Berry"],
      ["fluffybread", "Fluffy bread"],
      ["watermelonslice", "Watermelon slice"],
      ["leppasalad", "Leppa salad"],
    ],
  },
  Sour: {
    meaning: "This Pokémon prefers sour-tasting food. Matching flavor raises comfy level and your bond.",
    achieve: "Offer sour berries and dishes such as Aspear Berry, tomatoes, or Soda Pop.",
    examples: [
      ["aspearberry", "Aspear Berry"],
      ["tomato", "Tomato"],
      ["sodapop", "Soda Pop"],
      ["flavorfulsoup", "Flavorful soup"],
    ],
  },
  Spicy: {
    meaning: "This Pokémon prefers spicy-tasting food. Matching flavor raises comfy level and your bond.",
    achieve: "Offer spicy dishes such as fresh carrots, chili sauce, or electrifying soup.",
    examples: [
      ["freshcarrot", "Fresh carrot"],
      ["chilisauce", "Chili sauce"],
      ["electrifyingsoup", "Electrifying soup"],
      ["carrotbread", "Carrot bread"],
    ],
  },
  Bitter: {
    meaning: "This Pokémon prefers bitter-tasting food. Matching flavor raises comfy level and your bond.",
    achieve: "Offer bitter dishes such as Rawst Berry, seaweed, or potato.",
    examples: [
      ["rawstberry", "Rawst Berry"],
      ["seaweedsalad", "Seaweed salad"],
      ["potato", "Potato"],
      ["seaweedsoup", "Seaweed soup"],
    ],
  },
  Dry: {
    meaning: "This Pokémon prefers dry-tasting food. Matching flavor raises comfy level and your bond.",
    achieve: "Offer dry dishes such as Chesto Berry, wheat, or mushroom soup.",
    examples: [
      ["chestoberry", "Chesto Berry"],
      ["wheat", "Wheat"],
      ["cavemushrooms", "Cave mushrooms"],
      ["mushroomsoup", "Mushroom soup"],
    ],
  },
};

const AREAS: Record<string, { meaning: string; achieve?: string }> = {
  "Withered Wastelands": {
    meaning: "The first ruined grassland you rebuild. Many early friends and leaf-style kits start here.",
    achieve: "Restore the area, raise its environment level, and place habitats to attract wasteland spawns.",
  },
  "Bleak Beach": {
    meaning: "The coastal ruins along the shore, with sand kits and seaside habitats.",
    achieve: "Rebuild the beach, then set habitats on sand for coastal Pokémon.",
  },
  "Rocky Ridges": {
    meaning: "Mountain and cave country, with stone kits and ridge habitats.",
    achieve: "Explore the ridges and caves, then build stone homes for the Pokémon that live here.",
  },
  "Sparkling Skylands": {
    meaning: "High, windy islands above the other areas.",
    achieve: "Reach the skylands and place habitats up high for the species that appear there.",
  },
  "Palette Town": {
    meaning: "The rebuilt town hub, analogous to Pallet Town, with town kits and later unlocks.",
    achieve: "Restore the town and use it as a hub for friends who spawn or live here.",
  },
  "Cloud Island": {
    meaning: "A separate island with its own shop. Items you buy here stay on Cloud Island.",
    achieve: "Visit to shop and meet island-only friends. Do not expect those purchases to appear in other areas.",
  },
  "Bubbly Basin": {
    meaning: "The underwater expansion area from the Bubbly Basin pass.",
    achieve: "You need the expansion content enabled to explore this basin and befriend its Pokémon.",
  },
};

const TIMES: Record<string, string> = {
  Morning: "The early in-game hours. This species can appear at the habitat during morning.",
  Day: "The middle of the in-game day. This species can appear at the habitat while the sun is up.",
  Evening: "The in-game evening window. This species can appear at the habitat around dusk.",
  Night: "The in-game night hours. This species can appear at the habitat after dark.",
};

const WEATHER: Record<string, { meaning: string; achieve: string }> = {
  Sun: {
    meaning: "This spawn wants clear, sunny skies — not the same thing as a Bright home.",
    achieve:
      "Wait for sunshine, or set both Castform weather charms at a Sunny Day site to force sun in that area.",
  },
  Cloud: {
    meaning: "This spawn can appear under cloudy skies.",
    achieve: "Wait for overcast weather. Cloud is the default when you have not forced sun or rain.",
  },
  Rain: {
    meaning: "This spawn wants rainy weather.",
    achieve:
      "Wait for rain, or set both Castform weather charms at a Rain Dance site to force rain in that area.",
  },
};

const RARITY: Record<string, string> = {
  Common: "This species shows up often once the habitat, time, and weather match.",
  CommonCommon: "Recorded as common. This species shows up often once the habitat is active.",
  Rare: "This species is less likely to appear. You may need several visits even with the right setup.",
  "Very Rare": "This species is an uncommon visitor. Keep the habitat active and check back across days.",
};

const CONTENT: Record<string, { meaning: string; achieve?: string }> = {
  "Base game": {
    meaning: "Part of the main island roster. You do not need an event or expansion to find this entry.",
  },
  base: {
    meaning: "Part of the main island roster. You do not need an event or expansion to find this entry.",
  },
  Event: {
    meaning: "Tied to a limited event rather than the everyday island dex.",
    achieve: "Play the event while it is available, then record the friend here so you do not lose track.",
  },
  event: {
    meaning: "Tied to a limited event rather than the everyday island dex.",
    achieve: "Play the event while it is available, then record the friend here so you do not lose track.",
  },
  "Bubbly Basin expansion": {
    meaning: "Comes with the Bubbly Basin expansion, not the free base island.",
    achieve: "Enable the expansion, then explore Bubbly Basin habitats for this species.",
  },
  "expansion-pass": {
    meaning: "Comes with the Bubbly Basin expansion, not the free base island.",
    achieve: "Enable the expansion, then explore Bubbly Basin habitats for this species.",
  },
  "Fetching Scales for Feebas": {
    meaning: "An event Pokémon tied to the Feebas scale-fetching event.",
    achieve: "Complete that event while it is running to befriend this species.",
  },
  "More Spores for Hoppip": {
    meaning: "An event Pokémon tied to the Hoppip spore event.",
    achieve: "Complete that event while it is running to befriend this species.",
  },
  "Sableye's Gem Hunt": {
    meaning: "An event Pokémon tied to Sableye’s gem-hunt event.",
    achieve: "Complete that event while it is running to befriend this species.",
  },
  "Wish Upon a Jirachi": {
    meaning: "An event Pokémon tied to the Jirachi wish event.",
    achieve: "Complete that event while it is running to befriend this species.",
  },
};

const CONDITIONS: Record<string, { meaning: string; achieve: string }> = {
  "high-up location": {
    meaning: "The habitat has to sit on elevated ground, not at ordinary floor height.",
    achieve: "Build or place the setup on a high ledge, upper floor, or other raised spot, then add the listed items.",
  },
  "hot-spring water": {
    meaning: "The habitat needs hot-spring water in or next to the build, not ordinary freshwater.",
    achieve: "Place the setup at a hot spring or add a hot-spring spout so the water counts.",
  },
  "ocean water": {
    meaning: "The habitat needs seawater beside it.",
    achieve: "Build on the coast or at an ocean edge so the habitat touches seawater.",
  },
  "muddy water": {
    meaning: "The habitat needs muddy water nearby.",
    achieve: "Place it by a muddy pool, or create muddy water with the matching drink/spit trick, then build.",
  },
  waterfall: {
    meaning: "The habitat needs a waterfall in reach.",
    achieve: "Build beside a waterfall so the listed items sit in that spray zone.",
  },
  lava: {
    meaning: "The habitat needs lava in reach.",
    achieve: "Place it next to lava, or create lava with chili sauce, then add the other requirements.",
  },
  water: {
    meaning: "The habitat needs a water surface, not just a water-themed decoration.",
    achieve: "Build beside a pond, basin, or other water tile so the setup touches water.",
  },
  "plated food": {
    meaning: "The habitat wants food set out on a plate, not a raw ingredient in your bag.",
    achieve: "Place a plated meal in the habitat using a plate or dining set.",
  },
};

const ANY_KIND: Record<string, { meaning: string; pattern: RegExp; achieve: string }> = {
  bed: {
    meaning: "Any bed counts for this habitat. You do not need one specific model.",
    pattern: /bed/i,
    achieve: "Place any recorded bed in the habitat footprint.",
  },
  seat: {
    meaning: "Any seat counts: chairs, stools, sofas, or benches.",
    pattern: /chair|sofa|stool|bench|seat/i,
    achieve: "Place any chair, sofa, stool, or bench in the habitat.",
  },
  table: {
    meaning: "Any table or desk counts for this habitat.",
    pattern: /table|desk/i,
    achieve: "Place any table or desk in the habitat footprint.",
  },
  doll: {
    meaning: "Any doll counts. A specific species doll is not required.",
    pattern: /doll/i,
    achieve: "Place any Pokémon doll in the habitat.",
  },
  lighting: {
    meaning: "Any lamp, light, lantern, or similar fixture counts.",
    pattern: /lamp|light|lantern|candle|torch/i,
    achieve: "Place any light source in the habitat. Generate Pokémon can power electric ones.",
  },
  toy: {
    meaning: "Any toy counts for this habitat.",
    pattern: /toy|doll|slide|punching/i,
    achieve: "Place any toy in the habitat footprint.",
  },
  "waste bin": {
    meaning: "Any bin or trash container counts.",
    pattern: /garbage|bin|recycling/i,
    achieve: "Place a garbage bin, recycling bin, or similar container in the habitat.",
  },
  dresser: {
    meaning: "Any dresser or closet counts.",
    pattern: /dresser|closet/i,
    achieve: "Place a dresser or closet in the habitat footprint.",
  },
  stand: {
    meaning: "Any stand or pedestal counts.",
    pattern: /stand|pedestal/i,
    achieve: "Place a stand, pedestal, or similar display piece in the habitat.",
  },
};

function requirementKind(name: string): "item" | "condition" {
  const key = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (/\(any\)/i.test(name) || CONDITIONS[key] || CONDITIONS[key.replace(/s$/, "")])
    return "condition";
  return "item";
}

function lookup(map: Record<string, { meaning: string; achieve?: string }>, value: string) {
  return (
    map[value] ||
    map[value.replace(/\s+/g, " ")] ||
    Object.entries(map).find(([key]) => key.toLowerCase() === value.toLowerCase())?.[1]
  );
}

function itemsFromPairs(pairs: [string, string][], items: Item[]) {
  return pairs.map(([id, name]) => namedItem(id, name, items));
}

function favoriteItems(category: string, items: Item[], limit = 6) {
  return items
    .filter((item) => item.categories.includes(category))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      image: itemImageUrl(item.id),
      categories: item.categories,
      source: item.source,
    }));
}

function anyKind(name: string) {
  const base = name.replace(/\s*\(any\)\s*/i, "").replace(/\s*\(wide\)\s*/i, "").trim().toLowerCase();
  return ANY_KIND[base] || Object.entries(ANY_KIND).find(([key]) => base.includes(key))?.[1];
}

function examplesForPattern(pattern: RegExp, items: Item[], limit = 6) {
  return items
    .filter((item) => pattern.test(item.name))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      image: itemImageUrl(item.id),
      categories: item.categories,
      source: item.source,
    }));
}

export function explainTerm(term: TermRef, items: Item[]): TermExplanation {
  const value = term.value.trim();
  const title = term.label || (term.quantity ? `${term.quantity} × ${value}` : value);
  const base = {
    title,
    kindLabel: KIND_LABELS[term.kind],
    items: [] as ExplainedItem[],
    quantity: term.quantity,
  };

  if (term.kind === "environment") {
    const entry = ENVIRONMENTS[value];
    return {
      ...base,
      meaning: entry?.meaning || `Ideal environment recorded as ${value}. Matching this in a home helps comfy level.`,
      achieve: entry?.achieve,
      items: entry ? itemsFromPairs(entry.examples, items) : [],
    };
  }

  if (term.kind === "specialty") {
    const entry = SPECIALTIES[value];
    return {
      ...base,
      meaning: entry?.meaning || `${value} is a work specialty. Ask this Pokémon when a task calls for it.`,
      achieve: entry?.achieve,
      heroImage: specialtyImageUrl(value) || undefined,
    };
  }

  if (term.kind === "favorite") {
    const entry = lookup(FAVORITES, value);
    return {
      ...base,
      meaning:
        entry?.meaning ||
        `${value} is a favorite furnishing category. Matching objects in the home help comfy level.`,
      achieve:
        entry?.achieve ||
        "Place objects from this category inside the Pokémon’s home or habitat comfort zone.",
      items: favoriteItems(value, items),
    };
  }

  if (term.kind === "food") {
    const flavor = flavorKey(value) || value;
    const entry = FOOD[flavor];
    return {
      ...base,
      title: term.label || `${flavor} flavors`,
      meaning:
        entry?.meaning ||
        `Preferred flavor recorded as ${value}. Matching food helps comfy level and your bond.`,
      achieve: entry?.achieve,
      items: entry ? itemsFromPairs(entry.examples, items) : [],
    };
  }

  if (term.kind === "area") {
    const entry = lookup(AREAS, value);
    return {
      ...base,
      meaning: entry?.meaning || `${value} is an island area where this species can be found or housed.`,
      achieve: entry?.achieve,
    };
  }

  if (term.kind === "time") {
    return {
      ...base,
      meaning:
        TIMES[value] ||
        `${value} is an in-game time window. The habitat needs this time for the spawn to appear.`,
      achieve: "Wait until the island clock reaches this window, then check the habitat.",
    };
  }

  if (term.kind === "weather") {
    const entry = WEATHER[value];
    return {
      ...base,
      meaning: entry?.meaning || `${value} is a sky condition this spawn can appear under.`,
      achieve: entry?.achieve,
      items:
        value === "Sun" || value === "Rain"
          ? [namedItem("castformweathercharm", "Castform weather charm", items)]
          : [],
    };
  }

  if (term.kind === "rarity") {
    return {
      ...base,
      meaning:
        RARITY[value] ||
        `${value} describes how often this species appears when the habitat is correctly set up.`,
    };
  }

  if (term.kind === "content") {
    const entry = lookup(CONTENT, value);
    return {
      ...base,
      meaning: entry?.meaning || `${value} is the content pack or event this entry belongs to.`,
      achieve: entry?.achieve,
    };
  }

  if (term.kind === "habitat") {
    return {
      ...base,
      meaning: `${value} is an attracting habitat. Wild Pokémon visit after you place the required items in a valid spot.`,
      achieve:
        "Build the listed requirements, match time and weather, and wait. Moving a befriended friend into a house later is separate from this spawn setup.",
    };
  }

  if (term.kind === "condition") {
    const key = value.toLowerCase().replace(/\s+/g, " ").trim();
    const any = anyKind(value);
    const entry = CONDITIONS[key] || CONDITIONS[key.replace(/s$/, "")];
    return {
      ...base,
      kindLabel: any ? "Any of this kind" : KIND_LABELS.condition,
      meaning:
        any?.meaning ||
        entry?.meaning ||
        `${value} is a placement condition for the habitat, not a bag item you craft.`,
      achieve: any?.achieve || entry?.achieve,
      items: any ? examplesForPattern(any.pattern, items) : [],
    };
  }

  const item = resolveItem(term.id || value, items);
  const obtain = itemObtain(item);
  return {
    ...base,
    title: term.quantity ? `${term.quantity} × ${item.name}` : item.name,
    meaning: term.quantity
      ? `Place ${term.quantity} of this in the habitat footprint.`
      : item.categories.length
        ? `${item.name} is a furnishing Pokémon may like.`
        : `${item.name} is used in habitat builds or home furnishing.`,
    obtain: obtain.length
      ? obtain
      : ["Where to find this isn’t recorded yet. Check the reference link below."],
    items: [],
    categories: item.categories,
    source: item.source,
    heroImage: item.image,
  };
}

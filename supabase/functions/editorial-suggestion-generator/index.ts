// RoamSonio weekly editorial suggestion generator.
// Deploy as Supabase Edge Function: editorial-suggestion-generator.
// Required Supabase function secret: EDITORIAL_JOB_SECRET. Uses a curated no-API-cost idea pool.
// Uses the function's SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment values.
// All generated destinations and photos remain drafts/unapproved. Never edits trips.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const slug = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
const normalized = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function commonsCandidates(query: string) {
  // Use two explicit API requests: Commons search first, then fetch imageinfo by page ID.
  // This avoids the combined generator=search + imageinfo lookup that returned empty galleries in the admin UI.
  const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
  searchUrl.search = new URLSearchParams({
    action: "query", list: "search", srsearch: query, srnamespace: "6", srlimit: "24",
    format: "json", origin: "*"
  }).toString();
  const searchResponse = await fetch(searchUrl, { headers: { "User-Agent": "RoamSonioEditorialBot/1.0 (editorial draft generation)" } });
  if (!searchResponse.ok) throw new Error("Wikimedia Commons search failed (" + searchResponse.status + ")");
  const searchData = await searchResponse.json();
  if (searchData?.error) throw new Error("Wikimedia Commons search error: " + String(searchData.error.info || "unknown error"));
  const hits = (searchData?.query?.search || []) as any[];
  if (!hits.length) return [];
  const detailUrl = new URL("https://commons.wikimedia.org/w/api.php");
  detailUrl.search = new URLSearchParams({
    action: "query", pageids: hits.map((p: any) => String(p.pageid)).filter(Boolean).join("|"),
    prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1200", format: "json", origin: "*"
  }).toString();
  const detailResponse = await fetch(detailUrl, { headers: { "User-Agent": "RoamSonioEditorialBot/1.0 (editorial draft generation)" } });
  if (!detailResponse.ok) throw new Error("Wikimedia Commons image details failed (" + detailResponse.status + ")");
  const detailData = await detailResponse.json();
  if (detailData?.error) throw new Error("Wikimedia Commons image detail error: " + String(detailData.error.info || "unknown error"));
  const pages = Object.values(detailData?.query?.pages || {}) as any[];
  return pages.map((p: any) => {
    const info = p.imageinfo?.[0] || {};
    const meta = info.extmetadata || {};
    const plain = (x: any) => String(x?.value || "").replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim();
    const artist = plain(meta.Artist);
    const license = plain(meta.LicenseShortName);
    const description = plain(meta.ImageDescription);
    return {
      title: String(p.title || ""),
      url: String(info.thumburl || info.url || ""),
      source_url: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(String(p.title || "").replace(/ /g, "_")),
      credit: [artist, license ? "License: " + license : ""].filter(Boolean).join(" · "),
      alt_text: description || query + " travel photography",
      license_url: String(meta.LicenseUrl?.value || ""),
    };
  }).filter((p: any) => p.url.startsWith("https://") && p.source_url.startsWith("https://") && p.credit && p.title && p.license_url);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const expected = Deno.env.get("EDITORIAL_JOB_SECRET");
  const auth = req.headers.get("authorization") || "";
  if (!expected || auth !== "Bearer " + expected) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase function environment is not configured" }, 500);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const startedAt = new Date().toISOString();
  let created = 0, duplicates = 0, photoCandidates = 0;
  const failures: string[] = [];
  try {
    const { data: existing, error: readError } = await supabase.from("roamsonio_editorial_destinations")
      .select("id,name,type,build_destination,metadata,created_at").limit(2000);
    if (readError) throw readError;

    // Curated idea pool: no paid AI API required. The pool intentionally spans cities,
    // lesser-known regions, outdoor activities, winter sports, coastlines, and road trips.
    // Each run selects entries not already present in the Editorial Library.
    const ideaPool = [
      { name: "Dolomites Hut-to-Hut Hiking", type: "Outdoor", category: "Hiking", destination: "Dolomites, Italy", tagline: "Walk between dramatic limestone peaks and welcoming mountain rifugios.", activities: ["Hut-to-hut hiking", "Alpine lakes", "Mountain villages"], seasons: ["Summer", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Dolomites hiking routes and rifugio season" },
      { name: "Quebec Winter Carnival", type: "Seasonal Experience", category: "Winter festival", destination: "Quebec City, Canada", tagline: "Discover snow sculptures, historic streets, and a lively winter festival.", activities: ["Winter festival", "Old town walks", "Local food"], seasons: ["Winter"], region: "North America", domesticOrInternational: "International", planningHorizon: "Next season", researchNotes: "Quebec Winter Carnival dates and visitor information" },
      { name: "Madeira Levada Trails", type: "Outdoor", category: "Nature and hiking", destination: "Madeira, Portugal", tagline: "Follow lush water channels through forests, cliffs, and ocean viewpoints.", activities: ["Levada walks", "Botanical gardens", "Coastal viewpoints"], seasons: ["Spring", "Summer", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "Flexible", researchNotes: "Madeira official tourism levada walking routes" },
      { name: "Santa Fe Art and Adobe", type: "City", category: "Arts and culture", destination: "Santa Fe, New Mexico, USA", tagline: "Explore adobe architecture, galleries, regional cuisine, and high-desert light.", activities: ["Art galleries", "Historic plaza", "New Mexican cuisine"], seasons: ["Spring", "Summer", "Fall"], region: "Southwest US", domesticOrInternational: "Domestic", planningHorizon: "Flexible", researchNotes: "Santa Fe museums galleries and historic district" },
      { name: "Banff Snow Season", type: "Ski & Snowboard", category: "Winter sports", destination: "Banff and Lake Louise, Alberta, Canada", tagline: "Pair big-mountain skiing with alpine scenery and a walkable mountain town.", activities: ["Skiing", "Snowboarding", "Hot springs"], seasons: ["Winter"], region: "North America", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Banff Lake Louise ski season official information" },
      { name: "Portugal Alentejo Villages", type: "Region", category: "Small towns and food", destination: "Alentejo, Portugal", tagline: "Slow down among whitewashed villages, cork forests, and regional cooking.", activities: ["Village visits", "Local food", "Countryside drives"], seasons: ["Spring", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "Flexible", researchNotes: "Alentejo official tourism villages and heritage" },
      { name: "Blue Ridge Parkway Overlooks", type: "Road Trip", category: "Scenic drive", destination: "Blue Ridge Parkway, Virginia and North Carolina, USA", tagline: "Plan a mountain road trip around overlooks, short trails, and small-town stops.", activities: ["Scenic driving", "Short hikes", "Mountain towns"], seasons: ["Spring", "Summer", "Fall"], region: "Southeast US", domesticOrInternational: "Domestic", planningHorizon: "Current season", researchNotes: "National Park Service Blue Ridge Parkway road status and overlooks" },
      { name: "Kyoto Garden Seasons", type: "City", category: "Gardens and culture", destination: "Kyoto, Japan", tagline: "Discover temple gardens, quiet lanes, and seasonal color beyond the busiest sights.", activities: ["Temple gardens", "Traditional streets", "Tea culture"], seasons: ["Spring", "Fall"], region: "Asia", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Kyoto official tourism gardens seasonal visits" },
      { name: "Oregon Coast Lighthouse Route", type: "Road Trip", category: "Coastal road trip", destination: "Oregon Coast, Oregon, USA", tagline: "Trace rugged headlands, historic lighthouses, tide pools, and beach towns.", activities: ["Lighthouse visits", "Tide pools", "Coastal hikes"], seasons: ["Spring", "Summer", "Fall"], region: "Pacific Northwest", domesticOrInternational: "Domestic", planningHorizon: "Flexible", researchNotes: "Oregon coast official tourism lighthouses and state parks" },
      { name: "Chamonix Alpine Adventure", type: "Outdoor", category: "Mountain adventure", destination: "Chamonix, France", tagline: "Build an alpine escape around cable-car viewpoints, trails, and mountain culture.", activities: ["Mountain hikes", "Cable cars", "Alpine dining"], seasons: ["Summer", "Winter"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Chamonix official tourism mountain activities and seasonal access" },
      { name: "Charleston Lowcountry Weekend", type: "City", category: "Food and history", destination: "Charleston, South Carolina, USA", tagline: "Combine historic streets, waterfront scenery, and Lowcountry flavors in a relaxed weekend.", activities: ["Historic district", "Waterfront walks", "Regional cuisine"], seasons: ["Spring", "Fall"], region: "Southeast US", domesticOrInternational: "Domestic", planningHorizon: "Flexible", researchNotes: "Charleston official tourism historic district and food" },
      { name: "Slovenia Lake and Valley Loop", type: "Road Trip", category: "Nature road trip", destination: "Lake Bled and Soča Valley, Slovenia", tagline: "Connect a storybook lake with emerald rivers, mountain villages, and scenic drives.", activities: ["Lake walks", "River viewpoints", "Village stops"], seasons: ["Summer", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Slovenia official tourism Lake Bled and Soca Valley" },
      { name: "Utah Mighty Five Shoulder Season", type: "Road Trip", category: "National parks", destination: "Southern Utah, USA", tagline: "Explore red-rock landscapes with cooler-weather hikes and stargazing stops.", activities: ["National parks", "Scenic hikes", "Stargazing"], seasons: ["Spring", "Fall"], region: "Southwest US", domesticOrInternational: "Domestic", planningHorizon: "Next season", researchNotes: "National Park Service southern Utah parks seasonal planning" },
      { name: "Lofoten Fishing Villages", type: "Coast & Island", category: "Island scenery", destination: "Lofoten Islands, Norway", tagline: "Discover red fishing cabins, sharp peaks, and dramatic Arctic coastlines.", activities: ["Fishing villages", "Coastal hikes", "Photography"], seasons: ["Summer", "Winter"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Visit Lofoten official tourism seasons and villages" },
      { name: "New Orleans Music and Neighborhoods", type: "City", category: "Music and food", destination: "New Orleans, Louisiana, USA", tagline: "Go beyond the headline sights with neighborhood music, markets, and Creole flavors.", activities: ["Live music", "Food markets", "Historic neighborhoods"], seasons: ["Spring", "Fall", "Winter"], region: "Gulf Coast US", domesticOrInternational: "Domestic", planningHorizon: "Flexible", researchNotes: "New Orleans official tourism music neighborhoods and food" },
      { name: "Hokkaido Powder and Hot Springs", type: "Ski & Snowboard", category: "Winter sports", destination: "Hokkaido, Japan", tagline: "Pair renowned powder snow with onsen towns and warming regional food.", activities: ["Skiing", "Snowboarding", "Hot springs"], seasons: ["Winter"], region: "Asia", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Hokkaido official tourism ski areas and onsen" },
      { name: "Azores Volcanic Lakes", type: "Outdoor", category: "Volcanic landscapes", destination: "São Miguel, Azores, Portugal", tagline: "Find crater lakes, thermal pools, green hills, and ocean viewpoints on one island.", activities: ["Crater lake viewpoints", "Thermal pools", "Coastal drives"], seasons: ["Spring", "Summer", "Fall"], region: "Atlantic", domesticOrInternational: "International", planningHorizon: "Flexible", researchNotes: "Azores official tourism Sao Miguel volcanic lakes" },
      { name: "Savannah Squares and Riverfront", type: "City", category: "History and walking", destination: "Savannah, Georgia, USA", tagline: "Wander shaded historic squares, riverfront streets, and neighborhood cafés.", activities: ["Historic squares", "Riverfront walks", "Local food"], seasons: ["Spring", "Fall"], region: "Southeast US", domesticOrInternational: "Domestic", planningHorizon: "Flexible", researchNotes: "Visit Savannah official historic district" },
      { name: "Swiss Rail and Mountain Villages", type: "Region", category: "Rail and mountains", destination: "Bernese Oberland, Switzerland", tagline: "Connect mountain villages and lakefront towns by scenic rail instead of a packed itinerary.", activities: ["Scenic trains", "Mountain viewpoints", "Lake walks"], seasons: ["Summer", "Winter"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Switzerland tourism Bernese Oberland rail and villages" },
      { name: "Maine Lighthouse and Lobster Trail", type: "Road Trip", category: "Coastal food trip", destination: "Midcoast Maine, USA", tagline: "Follow working harbors, lighthouse parks, and classic seafood stops along the coast.", activities: ["Lighthouse visits", "Harbor towns", "Seafood"], seasons: ["Summer", "Fall"], region: "New England", domesticOrInternational: "Domestic", planningHorizon: "Next season", researchNotes: "Maine tourism coastal lighthouses and harbor towns" },
      { name: "Atlas Mountains and Berber Villages", type: "Outdoor", category: "Culture and hiking", destination: "Atlas Mountains, Morocco", tagline: "Explore mountain trails, village markets, and landscapes beyond the city medinas.", activities: ["Guided hikes", "Village visits", "Markets"], seasons: ["Spring", "Fall"], region: "North Africa", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Morocco official tourism Atlas Mountains village travel" },
      { name: "Great Lakes Island Escape", type: "Coast & Island", category: "Island getaway", destination: "Mackinac Island, Michigan, USA", tagline: "Trade cars for bikes and explore shoreline paths, historic sites, and island views.", activities: ["Cycling", "Historic sites", "Waterfront walks"], seasons: ["Summer", "Fall"], region: "Great Lakes US", domesticOrInternational: "Domestic", planningHorizon: "Next season", researchNotes: "Mackinac Island official visitor information and ferry season" },
      { name: "Andalusia White Villages", type: "Road Trip", category: "Heritage road trip", destination: "Andalusia, Spain", tagline: "Link hilltop white villages, Moorish architecture, and lively local markets.", activities: ["Village drives", "Historic architecture", "Local markets"], seasons: ["Spring", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Andalusia official tourism pueblos blancos" },
      { name: "Colorado Fall Aspens", type: "Seasonal Experience", category: "Fall foliage", destination: "Colorado Rockies, USA", tagline: "Plan a mountain-color getaway with scenic drives, gentle trails, and small towns.", activities: ["Aspen viewing", "Scenic drives", "Mountain towns"], seasons: ["Fall"], region: "Rocky Mountains US", domesticOrInternational: "Domestic", planningHorizon: "Next season", researchNotes: "Colorado tourism fall foliage routes" },
      { name: "Olympic Peninsula Rainforest and Coast", type: "Road Trip", category: "Rainforest and coastline", destination: "Olympic Peninsula, Washington, USA", tagline: "Combine mossy temperate rainforests, rugged beaches, and mountain viewpoints.", activities: ["Rainforest trails", "Beach walks", "Scenic drives"], seasons: ["Spring", "Summer", "Fall"], region: "Pacific Northwest", domesticOrInternational: "Domestic", planningHorizon: "Flexible", researchNotes: "National Park Service Olympic National Park visitor guidance" },
      { name: "New Mexico Dark Sky Road Trip", type: "Road Trip", category: "Stargazing", destination: "New Mexico, USA", tagline: "Build an unhurried route around desert landscapes, observatories, and exceptionally dark skies.", activities: ["Stargazing", "Desert scenery", "Small towns"], seasons: ["Spring", "Fall"], region: "Southwest US", domesticOrInternational: "Domestic", planningHorizon: "Flexible", researchNotes: "New Mexico official tourism dark sky locations" },
      { name: "Finger Lakes Waterfalls and Wineries", type: "Region", category: "Waterfalls and countryside", destination: "Finger Lakes, New York, USA", tagline: "Explore gorge trails, lakeside villages, and relaxed countryside drives.", activities: ["Waterfall hikes", "Lake towns", "Local food"], seasons: ["Spring", "Summer", "Fall"], region: "Northeast US", domesticOrInternational: "Domestic", planningHorizon: "Flexible", researchNotes: "Finger Lakes official tourism state parks and villages" },
      { name: "Alaska Glacier and Wildlife Journey", type: "Outdoor", category: "Wildlife and glaciers", destination: "Southcentral Alaska, USA", tagline: "Pair glacier viewpoints with wildlife watching and dramatic coastal scenery.", activities: ["Glacier viewpoints", "Wildlife watching", "Coastal drives"], seasons: ["Summer"], region: "Alaska", domesticOrInternational: "Domestic", planningHorizon: "Next season", researchNotes: "Alaska official visitor information and seasonal access" },
      { name: "Cappadocia Valleys and Cave Towns", type: "Region", category: "Landscape and heritage", destination: "Cappadocia, Türkiye", tagline: "Discover sculpted valleys, cave architecture, and small-town hospitality.", activities: ["Valley walks", "Historic sites", "Local markets"], seasons: ["Spring", "Fall"], region: "West Asia", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Türkiye official tourism Cappadocia visitor information" },
      { name: "Tuscany by Local Train", type: "Road Trip", category: "Rail and small towns", destination: "Tuscany, Italy", tagline: "Connect art cities and hill towns with a slower itinerary built around local trains.", activities: ["Regional trains", "Historic centers", "Food markets"], seasons: ["Spring", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Trenitalia regional routes and official Tuscany tourism" },
      { name: "Scottish Highlands Scenic Rail", type: "Region", category: "Scenic rail", destination: "Scottish Highlands, Scotland", tagline: "Plan a rail-led journey through lochs, mountain scenery, and welcoming villages.", activities: ["Scenic trains", "Loch viewpoints", "Village walks"], seasons: ["Spring", "Summer", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Scotland official tourism rail routes and Highland visitor information" },
      { name: "Patagonia Lakes and Easy Day Hikes", type: "Outdoor", category: "Lakes and mountains", destination: "Argentine Patagonia, Argentina", tagline: "Use a lakeside base for approachable trails, mountain views, and relaxed town evenings.", activities: ["Day hikes", "Lake viewpoints", "Town cafés"], seasons: ["Spring", "Summer", "Fall"], region: "South America", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Argentina official tourism Patagonia parks and seasonal travel" },
      { name: "Raja Ampat Island Nature Escape", type: "Coast & Island", category: "Island nature", destination: "Raja Ampat, Indonesia", tagline: "Explore vivid island scenery and marine life with locally guided, low-impact outings.", activities: ["Snorkeling", "Island viewpoints", "Village visits"], seasons: ["Fall", "Winter", "Spring"], region: "Southeast Asia", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Indonesia official tourism Raja Ampat conservation and visitor guidance" },
      { name: "Cotswolds Villages and Garden Walks", type: "Region", category: "Villages and gardens", destination: "Cotswolds, England", tagline: "Link honey-stone villages, gardens, country walks, and traditional market towns.", activities: ["Village walks", "Gardens", "Market towns"], seasons: ["Spring", "Summer", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "Flexible", researchNotes: "Visit England and Cotswolds official visitor information" },
      { name: "Dolomites Winter Village Escape", type: "Ski & Snowboard", category: "Winter village and snow sports", destination: "Val Gardena, Italy", tagline: "Pair winter trails and ski days with cozy villages beneath dramatic peaks.", activities: ["Skiing", "Snowshoeing", "Mountain villages"], seasons: ["Winter"], region: "Europe", domesticOrInternational: "International", planningHorizon: "Next season", researchNotes: "Val Gardena official winter visitor information" },
      { name: "Costa Rica Cloud Forests", type: "Outdoor", category: "Cloud forest nature", destination: "Monteverde, Costa Rica", tagline: "Discover misty forest trails, canopy views, and locally guided wildlife experiences.", activities: ["Cloud forest walks", "Birdwatching", "Nature reserves"], seasons: ["Winter", "Spring"], region: "Central America", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Costa Rica official tourism Monteverde nature reserves" },
      { name: "Jordan Desert and Ancient Wonders", type: "Road Trip", category: "Desert and heritage", destination: "Jordan", tagline: "Connect monumental history, desert landscapes, and welcoming towns on a thoughtful route.", activities: ["Archaeological sites", "Desert landscapes", "Local cuisine"], seasons: ["Spring", "Fall"], region: "Middle East", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Jordan official tourism visitor guidance and site access" },
      { name: "Basque Coast Food and Villages", type: "Region", category: "Coastal food culture", destination: "Basque Country, Spain", tagline: "Combine coastal walks, distinctive architecture, and a food-focused small-town itinerary.", activities: ["Coastal walks", "Food markets", "Historic centers"], seasons: ["Spring", "Summer", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "Flexible", researchNotes: "Basque Country official tourism coastal villages and food" },
      { name: "Mammoth Cave and Kentucky Backroads", type: "Road Trip", category: "Caves and countryside", destination: "Central Kentucky, USA", tagline: "Mix underground cave tours with scenic backroads, local food, and quiet countryside stops.", activities: ["Cave tours", "Scenic drives", "Local food"], seasons: ["Spring", "Summer", "Fall"], region: "Southeast US", domesticOrInternational: "Domestic", planningHorizon: "Flexible", researchNotes: "National Park Service Mammoth Cave visitor information" },
      { name: "Oaxaca Markets and Mountain Villages", type: "Region", category: "Culture and food", destination: "Oaxaca, Mexico", tagline: "Explore colorful markets, regional cooking, and mountain villages with local guides.", activities: ["Markets", "Cooking experiences", "Village visits"], seasons: ["Winter", "Spring", "Fall"], region: "North America", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Mexico official tourism Oaxaca visitor information" },
      { name: "Norwegian Fjord Ferry Journey", type: "Road Trip", category: "Fjord and ferry route", destination: "Western Norway", tagline: "Build a flexible route around fjord ferries, mountain roads, and waterside villages.", activities: ["Fjord ferries", "Scenic drives", "Village walks"], seasons: ["Summer"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Visit Norway official fjord routes and ferry travel" },
      { name: "Cape Cod Shoulder Season", type: "Coast & Island", category: "Coastal towns", destination: "Cape Cod, Massachusetts, USA", tagline: "Enjoy quieter beaches, maritime history, and village walks beyond peak summer.", activities: ["Beach walks", "Lighthouses", "Harbor towns"], seasons: ["Spring", "Fall"], region: "New England", domesticOrInternational: "Domestic", planningHorizon: "Current season", researchNotes: "Cape Cod official visitor information and seasonal activities" },
      { name: "Slovak Paradise Gorge Trails", type: "Outdoor", category: "Gorge hiking", destination: "Slovak Paradise National Park, Slovakia", tagline: "Explore forested gorges, waterfalls, and ladder-assisted trails with careful route planning.", activities: ["Gorge hikes", "Waterfalls", "Mountain villages"], seasons: ["Spring", "Summer", "Fall"], region: "Europe", domesticOrInternational: "International", planningHorizon: "3-6 months", researchNotes: "Slovakia official tourism and national park trail guidance" }
    ];
    const seen = new Set((existing || []).flatMap((x: any) => [normalized(x.name || ""), normalized(x.build_destination || ""), normalized(x.id || "")]));
    const candidates = ideaPool.filter((c) => !seen.has(normalized(c.name)) && !seen.has(normalized(c.destination)));
    const ideasInPool = ideaPool.length;
    const ideasAvailable = candidates.length;
    const ideasSkippedAsExisting = ideasInPool - ideasAvailable;

    for (const c of candidates) {
      try {
        const name = String(c.name || "").trim();
        const destination = String(c.destination || name).trim();
        const type = String(c.type || "");
        if (!name || !destination || !["City","Region","Ski & Snowboard","Outdoor","Coast & Island","Road Trip","Seasonal Experience"].includes(type)) continue;
        const key = normalized(name);
        const destKey = normalized(destination);
        if (seen.has(key) || seen.has(destKey) || seen.has(normalized(slug(name)))) { duplicates++; continue; }
        const id = slug(name);
        if (!id || (existing || []).some((x: any) => x.id === id)) { duplicates++; continue; }

        const metadata = {
          generated_by: "weekly-editorial-generator",
          generated_at: startedAt,
          review_status: "draft",
          region: String(c.region || ""),
          domestic_or_international: String(c.domesticOrInternational || ""),
          planning_horizon: String(c.planningHorizon || ""),
          research_notes: String(c.researchNotes || ""),
          source_urls: [],
          duplicate_key: key
        };
        const { error: insertError } = await supabase.from("roamsonio_editorial_destinations").insert({
          id, name, type, category: String(c.category || type), seasons: Array.isArray(c.seasons) ? c.seasons : [],
          activities: Array.isArray(c.activities) ? c.activities : [], buildable: true, build_destination: destination,
          tagline: String(c.tagline || ""), status: "draft", metadata
        });
        if (insertError) {
          if (insertError.code === "23505") { duplicates++; seen.add(key); continue; }
          throw insertError;
        }
        seen.add(key); seen.add(destKey); created++;

        // Photo sourcing is intentionally handled separately in Suggestion Studio.
        // Do not call Wikimedia from the scheduled generator: bulk searches trigger rate limits.
        // Suggestions remain drafts; photos must be sourced and approved through the admin workflow.
      } catch (e) {
        failures.push(String(c?.name || "candidate") + ": " + (e instanceof Error ? e.message : String(e)));
      }
    }

    const result = { startedAt, finishedAt: new Date().toISOString(), ideasInPool, ideasAvailable, ideasSkippedAsExisting, created, duplicates, photoCandidates, failures, status: failures.length ? "completed_with_warnings" : "completed", message: ideasAvailable === 0 ? "No new ideas available; add more ideas to the curated pool." : `Reviewed ${ideasInPool} ideas; ${ideasAvailable} were new candidates.`, published: 0 };
    await supabase.from("roamsonio_admin_audit_log").insert({
      action: "editorial_suggestion_generation",
      details: result
    });
    return json(result);
  } catch (e) {
    const result = { startedAt, finishedAt: new Date().toISOString(), ideasInPool: typeof ideaPool === "undefined" ? 0 : ideaPool.length, created, duplicates, photoCandidates, status: "failed", error: e instanceof Error ? e.message : String(e), failures };
    try { await supabase.from("roamsonio_admin_audit_log").insert({ action: "editorial_suggestion_generation_failed", details: result }); } catch (_) {}
    return json(result, 500);
  }
});

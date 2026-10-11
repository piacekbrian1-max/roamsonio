// RoamSonio editorial photo-preparation worker.
// This is deliberately separate from editorial-suggestion-generator.
// It attaches only unapproved, source-attributed candidates to draft suggestions.
// It never changes trip, snapshot, family, user, or account data.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const norm = (v: unknown) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stop = new Set(["the","and","for","with","from","into","near","best","season","adventure","journey","trail","route","weekend","experience","explore","exploring","visit","trip","travel","scenic","seasonal","region","area","town","city","coast","island","mountain","mountains","village","villages","outdoor","culture","food","history","hiking","ski","skiing","snowboard","snowboarding","road","parkway"]);
const peopleTerms = /\b(portrait|selfie|headshot|person|people|man|woman|child|children|boy|girl|family|tourist|tourists|model|fashion|wedding|group photo|close up face|close-up face)\b/i;
const genericTerms = /\b(stock photo|illustration|logo|map of|flag of|poster|collage|clipart|rendering|artist impression|plaque|inscription|memorial marker|commemorative tablet|building under construction|construction site|high rise building|office tower|hotel facade|parking garage|sculpture base|tombstone|grave marker|apartment building|condominium|commercial building|business district|downtown skyline)\b/i;
const scenicTerms = /\b(landscape|coast|coastal|beach|waterfall|volcano|crater|lava|ocean|sea|island|mountain|mountains|cliff|valley|forest|rainforest|tropical|lagoon|reef|sunset|sunrise|panorama|scenic|national park|bay|shore|shoreline|canyon|ridge|viewpoint)\b/i;

function geographyTerms(destination: string, name: string) {
  const raw = (destination + " " + name).split(/[;,|]/).map(s => norm(s)).join(" ");
  const terms = raw.split(/\s+/).filter(t => t.length >= 4 && !stop.has(t) && !/^\d+$/.test(t));
  return [...new Set(terms)].slice(0, 12);
}
function destinationAliases(destination: string, name: string) {
  const label = norm(destination + " " + name);
  if (label.includes("hawaii")) {
    return ["Na Pali Coast Kauai Hawaii", "Hawaii Volcanoes National Park lava landscape", "Waimea Canyon Kauai Hawaii", "Hana Maui coastline waterfall", "Hawaii tropical beach turquoise water"];
  }
  if (label.includes("colorado") && (label.includes("ski") || label.includes("country"))) {
    return ["Vail Colorado", "Aspen Colorado", "Telluride Colorado", "Breckenridge Colorado", "Rocky Mountains Colorado"];
  }
  if (label.includes("canadian rockies")) {
    return ["Banff National Park", "Lake Louise Alberta", "Moraine Lake Alberta", "Jasper National Park"];
  }
  if (label.includes("banff") || label.includes("lake louise")) {
    return ["Banff National Park", "Lake Louise Alberta", "Moraine Lake Alberta", "Canadian Rockies Alberta"];
  }
  if (label.includes("dolomites")) {
    return ["Tre Cime di Lavaredo", "Seceda Dolomites", "Alpe di Siusi", "Val di Funes"];
  }
  if (label.includes("french alps")) {
    return ["Chamonix Mont Blanc", "Annecy French Alps", "Mer de Glace", "Aiguille du Midi"];
  }
  if (label.includes("christmas market") || label.includes("christmas markets")) {
    return ["Strasbourg Christmas Market", "Vienna Christmas Market", "Prague Christmas Market", "Nuremberg Christmas Market"];
  }
  return [];
}
function relevance(item: any, destination: string, name: string) {
  const raw = String(item.title || "") + " " + String(item.description || "");
  const title = norm(item.title);
  const desc = norm(item.description);
  const combined = norm(raw);
  if (!title || peopleTerms.test(raw) || genericTerms.test(raw)) return { ok: false, score: 0 };
  const query = norm(item.searchQuery || "");
  const queryTerms = [...new Set(query.split(" ").filter((t: string) => t.length >= 4 && !stop.has(t)))];
  const placeTerms = geographyTerms(destination, name).filter(t => !["united","states","america","canada","italy","france","japan","portugal","norway","slovakia","switzerland","spain","morocco","mexico","jordan","georgia","virginia","carolina","oregon","maine","kentucky","colorado","new","south","north","western","central","eastern","southern","alberta","massachusetts","country"].includes(t));
  const queryHits = queryTerms.filter(t => title.includes(t));
  const descQueryHits = queryTerms.filter(t => desc.includes(t));
  const placeHits = placeTerms.filter(t => title.includes(t) || desc.includes(t));
  const scenicWords = ["landscape","coast","coastal","beach","waterfall","volcano","crater","lava","ocean","sea","island","mountain","cliff","valley","forest","tropical","lagoon","reef","sunset","sunrise","panorama","scenic","national park","bay","shore","canyon","ridge","viewpoint","castle","cathedral","church","bridge","old town","historic center","plaza","square","palace","temple","pagoda","monastery","harbor","harbour","lake","waterfront","ski resort","alpine","market square","christmas market","lighthouse","dunes","desert","glacier","fjord"];
  const visual = scenicWords.some(t => combined.includes(norm(t)));
  const blockedWords = ["plaque","inscription","memorial marker","commemorative tablet","information board","museum label","document","manuscript","book page","stamp","postcard","painting","drawing","illustration","logo","coat of arms","fossil","mineral specimen","rock specimen","geological sample","hotel room","office tower","construction site","parking lot","license plate"];
  if (blockedWords.some(t => combined.includes(norm(t))) || !visual) return { ok: false, score: 0 };
  const label = norm(destination + " " + name);
  const iconic: Record<string, string[]> = {
    hawaii: ["na pali coast","waimea canyon","haleakala","road to hana","hawaii volcanoes national park","diamond head","kauai coastline","maui coastline"],
    "canadian rockies": ["moraine lake","lake louise","jasper national park","icefields parkway","peyto lake","banff national park"],
    banff: ["moraine lake","lake louise","bow lake","banff national park","icefields parkway","peyto lake"],
    santorini: ["oia","fira","blue dome","caldera","santorini sunset","imerovigli"],
    "cape cod": ["cape cod national seashore","nauset light","highland light","chatham lighthouse","provincetown","cape cod beach","salt marsh"],
    madrid: ["royal palace of madrid","plaza mayor","gran via","retiro park","puerta del sol","cibeles palace","prado museum"],
    "christmas markets": ["strasbourg christmas market","vienna christmas market","prague christmas market","nuremberg christmas market","colmar christmas market"],
    "french alps": ["chamonix","mont blanc","aiguille du midi","mer de glace","annecy"],
    dolomites: ["tre cime di lavaredo","seceda","alpe di siusi","lago di braies","val di funes"]
  };
  let iconicHit = false;
  for (const [key, values] of Object.entries(iconic)) if (label.includes(key) && values.some(t => combined.includes(norm(t)))) iconicHit = true;
  const specialDestination = /hawaii|colorado.*aspens|canadian rockies|banff|lake louise|dolomites|french alps|chamonix|christmas markets?|kyoto|patagonia|raja ampat|costa rica|monteverde|new orleans|savannah|oaxaca|cappadocia|madeira|santorini/i.test(destination + " " + name);
  // A matching search phrase is not proof of relevance: Commons may return neighboring or loosely tagged files.
  // Require a recognizable destination landmark for broad/ambiguous destinations; otherwise require two meaningful
  // destination words in the file's own title/description. If metadata cannot prove relevance, reject the image.
  const destinationSpecific = specialDestination ? iconicHit : placeHits.filter((t: string) => t.length >= 4 && !["united","states","america","canada","italy","france","japan","portugal","norway","slovakia","switzerland","spain","morocco","mexico","jordan","georgia","virginia","carolina","oregon","maine","kentucky","colorado","new","south","north","western","central","eastern","southern","alberta","massachusetts","country","coast","island","region","city","town","mountain","mountains","national","park"].includes(t)).length >= 2;
  const queryMatches = queryHits.length > 0 || descQueryHits.length >= 2;
  const score = queryHits.length * 3 + descQueryHits.length * 2 + placeHits.length * 3 + (iconicHit ? 12 : 0) + (visual ? 8 : 0);
  return { ok: destinationSpecific && queryMatches && visual, score };
}
async function commonsSearch(query: string) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({ action:"query", list:"search", srsearch:query, srnamespace:"6", srlimit:"12", format:"json", origin:"*" }).toString();
  const response = await fetch(url, { headers: { "User-Agent": "RoamSonioPhotoPreparation/1.0 (destination-specific editorial review)" } });
  if (response.status === 429) throw new Error("Wikimedia rate limit (429); this item will be retried on a later run.");
  if (!response.ok) throw new Error("Wikimedia search failed (" + response.status + ")");
  const data = await response.json();
  if (data?.error) throw new Error("Wikimedia search error: " + String(data.error.info || "unknown error"));
  const hits = (data?.query?.search || []) as any[];
  if (!hits.length) return [];
  // Leave a generous gap between Wikimedia API requests to reduce rate limiting.
  await wait(3500);
  const detailsUrl = new URL("https://commons.wikimedia.org/w/api.php");
  detailsUrl.search = new URLSearchParams({ action:"query", pageids:hits.map(h=>String(h.pageid)).join("|"), prop:"imageinfo", iiprop:"url|extmetadata", iiurlwidth:"1200", format:"json", origin:"*" }).toString();
  const detailsResponse = await fetch(detailsUrl, { headers: { "User-Agent": "RoamSonioPhotoPreparation/1.0 (destination-specific editorial review)" } });
  if (detailsResponse.status === 429) throw new Error("Wikimedia rate limit (429) while reading image details; retry later.");
  if (!detailsResponse.ok) throw new Error("Wikimedia image details failed (" + detailsResponse.status + ")");
  const detailData = await detailsResponse.json();
  if (detailData?.error) throw new Error("Wikimedia image details error: " + String(detailData.error.info || "unknown error"));
  const candidates = Object.values(detailData?.query?.pages || {}).map((p: any) => {
    const info = p.imageinfo?.[0] || {};
    const meta = info.extmetadata || {};
    const plain = (x: any) => String(x?.value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const artist = plain(meta.Artist);
    const license = plain(meta.LicenseShortName);
    const licenseUrl = String(meta.LicenseUrl?.value || "");
    const description = plain(meta.ImageDescription);
    const title = String(p.title || "");
    return {
      pageid: String(p.pageid || ""),
      title,
      url: String(info.thumburl || info.url || ""),
      source_url: "https://commons.wikimedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")),
      credit: [artist, license ? "License: " + license : ""].filter(Boolean).join(" · "),
      license_url: licenseUrl,
      description
    };
  }).filter((p: any) => p.url.startsWith("https://") && p.source_url.startsWith("https://") && p.credit && p.license_url && p.title && p.description);
  await wait(3500);
  return candidates;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const expected = Deno.env.get("EDITORIAL_JOB_SECRET");
  if (!expected || req.headers.get("authorization") !== "Bearer " + expected) return json({ error: "Unauthorized" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase function environment is not configured" }, 500);
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession:false, autoRefreshToken:false } });
  const startedAt = new Date().toISOString();
  const processed: any[] = [];
  const usedAcrossBatch = new Set<string>();
  const failures: string[] = [];
  let photosAttached = 0, readyForApproval = 0, needsAttention = 0;
  try {
    const { data: allEntries, error: entriesError } = await supabase.rpc("roamsonio_worker_editorial_drafts");
    if (entriesError) throw entriesError;
    const drafts = (allEntries || []).filter((x: any) => (x.status || "draft") === "draft")
      .sort((a: any, b: any) => {
        const priority = (x: any) => {
          const label = String(x.build_destination || "") + " " + String(x.name || "");
          if (/hawaii/i.test(label)) return 0;
          if (String(x.metadata?.photo_preparation_source || "") === "Wikimedia Commons") return 1;
          return 2;
        };
        const priorityDifference = priority(a) - priority(b);
        if (priorityDifference !== 0) return priorityDifference;
        const at = Date.parse(String(a.metadata?.photo_preparation_checked_at || "")) || 0;
        const bt = Date.parse(String(b.metadata?.photo_preparation_checked_at || "")) || 0;
        return at - bt;
      });
    // Process a small sequential batch per run. Oldest/never-checked drafts go first,
    // so a difficult destination cannot block the rest of the queue indefinitely.
    const candidates: any[] = [];
    for (const entry of drafts) {
      if (candidates.length >= 3) break;
      const { data: photoRows, error: photoError } = await supabase.rpc("roamsonio_worker_editorial_photos", { p_destination_id: entry.id });
      if (photoError) {
        failures.push(String(entry.name) + ": could not inspect existing photo roles");
        continue;
      }
      let rows = photoRows || [];
      const roles = ["hero","secondary","mobile"];
      const replaceExisting = String(entry.metadata?.photo_preparation_source || "") === "Wikimedia Commons";
      if (roles.every(role => rows.some((p: any) => String(p.role || "").toLowerCase() === role && p.url && p.source_url && p.credit && p.alt_text)) && !replaceExisting) {
        readyForApproval++;
        continue;
      }
      candidates.push({ entry, rows, replaceExisting });
    }

    for (const item of candidates) {
      const entry = item.entry;
      const destination = String(entry.build_destination || entry.name || "").trim();
      const name = String(entry.name || "").trim();
      let existingRows = item.rows || [];
      let alreadyFilled = new Set(existingRows.filter((p: any) => p.url && p.source_url && p.credit && p.alt_text).map((p: any) => String(p.role || "").toLowerCase()));
      try {
        // Search several destination-specific phrases instead of one exact quoted phrase.
        // Existing conservative relevance checks below still decide which candidates may attach.
        const searchTerms = destination.replace(/&/g, " ").trim();
        const aliases = destinationAliases(destination, name);
        // At most two queries per destination per run. Prefer a known landmark for broad experiences.
        const isHawaii = /hawaii/i.test(destination + " " + name);
        const isCanadianRockies = /canadian rockies/i.test(destination + " " + name);
        const isBanff = /banff|lake louise/i.test(destination + " " + name);
        const queries = (isHawaii ? [
          "Na Pali Coast Kauai Hawaii scenic landscape",
          "Hawaii Volcanoes National Park coastline waterfall",
          "Waimea Canyon Kauai panorama"
        ] : isCanadianRockies ? [
          "Jasper National Park Canadian Rockies mountain lake landscape",
          "Moraine Lake Canadian Rockies panorama",
          "Icefields Parkway Canadian Rockies scenic landscape"
        ] : isBanff ? [
          "Lake Louise Banff National Park turquoise lake landscape",
          "Banff National Park Moraine Lake mountain landscape",
          "Bow Lake Icefields Parkway Banff scenic landscape"
        ] : [
          ...(aliases.length ? [aliases[0] + " landscape"] : []),
          name + " landmark",
          searchTerms + " landscape"
        ]).filter((query: string, index: number, all: string[]) => all.indexOf(query) === index).slice(0, (isHawaii || isCanadianRockies || isBanff) ? 3 : 2);
        const results: any[] = [];
        for (const query of [...new Set(queries)]) {
          const found = await commonsSearch(query);
          results.push(...found.map((photo: any) => ({ ...photo, searchQuery: query })));
        }
        const ranked = results.map((p: any) => ({ ...p, match: relevance(p, destination, name) }))
          .filter((p: any) => p.match.ok)
          .sort((a: any,b: any) => b.match.score-a.match.score);
        // Avoid assigning the same Commons image to multiple destinations in one batch.
        const unique = ranked.filter((p: any, i: number, arr: any[]) => arr.findIndex((q: any) => q.pageid === p.pageid) === i && !usedAcrossBatch.has(String(p.url || "")));
        if (item.replaceExisting) {
          // Keep the existing set unless three distinct replacement candidates are available.
          if (unique.length < 3) {
            failures.push(name + ": found only " + unique.length + " suitable replacement candidates; kept existing photos for manual review");
            needsAttention++;
            await supabase.rpc("roamsonio_worker_update_draft_metadata", {
              p_id: entry.id,
              p_metadata: Object.assign({}, entry.metadata || {}, {
                photo_preparation_status: "needs_attention",
                photo_preparation_checked_at: new Date().toISOString(),
                photo_preparation_error: "Insufficient distinct candidates to safely replace existing photos"
              })
            });
            continue;
          }
          const { error: replaceError } = await supabase.rpc("roamsonio_worker_delete_unapproved_commons_photos", { p_destination_id: entry.id });
          if (replaceError) throw replaceError;
          const { data: freshRows, error: freshError } = await supabase.rpc("roamsonio_worker_editorial_photos", { p_destination_id: entry.id });
          if (freshError) throw freshError;
          existingRows = freshRows || [];
          alreadyFilled = new Set(existingRows.filter((p: any) => p.url && p.source_url && p.credit && p.alt_text).map((p: any) => String(p.role || "").toLowerCase()));
        }
        const roles = ["hero","secondary","mobile"].filter(role => !alreadyFilled.has(role));
        const usedUrls = new Set(existingRows.map((p: any) => p.url).filter(Boolean));
        let attachedForEntry = 0;
        for (const role of roles) {
          const candidate = unique.find((p: any) => !usedUrls.has(p.url));
          if (!candidate) continue;
          const alt = "Photograph of " + destination + (candidate.description ? ": " + candidate.description.slice(0, 150) : "");
          const { error: saveError } = await supabase.rpc("roamsonio_worker_insert_editorial_photo", {
            p_destination_id: entry.id,
            p_url: candidate.url,
            p_alt_text: alt,
            p_credit: candidate.credit + " · Wikimedia Commons",
            p_source_url: candidate.source_url,
            p_role: role,
            p_sort_order: role === "hero" ? 0 : role === "secondary" ? 1 : 2
          });
          if (saveError) throw saveError;
          usedUrls.add(candidate.url);
          usedAcrossBatch.add(String(candidate.url || ""));
          attachedForEntry++;
          photosAttached++;
        }
        await wait(1800);
        const { data: refreshed, error: refreshError } = await supabase.rpc("roamsonio_worker_editorial_photos", { p_destination_id: entry.id });
        if (refreshError) throw refreshError;
        const refreshedRows = refreshed || [];
        const isReady = ["hero","secondary","mobile"].every(role => refreshedRows.some((p: any) => String(p.role || "").toLowerCase() === role && p.url && p.source_url && p.credit && p.alt_text));
        const metadata = Object.assign({}, entry.metadata || {}, {
          photo_preparation_status: isReady ? "ready_for_approval" : (attachedForEntry ? "preparing" : "needs_attention"),
          photo_preparation_checked_at: new Date().toISOString(),
          photo_preparation_source: "Wikimedia Commons",
          photo_preparation_policy: "strict destination/landmark match; rejects uncertain files; all photos unapproved"
        });
        const { error: updateError } = await supabase.rpc("roamsonio_worker_update_draft_metadata", {
          p_id: entry.id, p_metadata: metadata
        });
        if (updateError) throw updateError;
        if (isReady) readyForApproval++; else needsAttention++;
        processed.push({ id: entry.id, name, attached: attachedForEntry, status: isReady ? "ready_for_approval" : (attachedForEntry ? "preparing" : "needs_attention"), candidatesFound: unique.length });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        failures.push(name + ": " + message);
        const metadata = Object.assign({}, entry.metadata || {}, {
          photo_preparation_status: "needs_attention",
          photo_preparation_checked_at: new Date().toISOString(),
          photo_preparation_error: message.slice(0, 300)
        });
        try {
          await supabase.rpc("roamsonio_worker_update_draft_metadata", {
            p_id: entry.id, p_metadata: metadata
          });
        } catch (_) {}
        needsAttention++;
      }
    }
    const result = { startedAt, finishedAt:new Date().toISOString(), batchLimit:3, draftsReviewed:candidates.length, processed, photosAttached, readyForApproval, needsAttention, failures, published:0, tripRecordsChanged:0, status:failures.length ? "completed_with_warnings" : "completed" };
    await supabase.from("roamsonio_admin_audit_log").insert({ action:"editorial_photo_preparation", details:result });
    return json(result);
  } catch (e) {
    const result = { startedAt, finishedAt:new Date().toISOString(), status:"failed", error: e instanceof Error ? e.message : (typeof e === "object" && e !== null ? JSON.stringify(e, Object.getOwnPropertyNames(e)) : String(e)), processed, failures, published:0, tripRecordsChanged:0 };
    try { await supabase.from("roamsonio_admin_audit_log").insert({ action:"editorial_photo_preparation_failed", details:result }); } catch (_) {}
    return json(result, 500);
  }
});

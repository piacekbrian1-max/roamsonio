// RoamSonio weekly editorial suggestion generator.
// Deploy as Supabase Edge Function: editorial-suggestion-generator.
// Required Supabase function secrets: OPENAI_API_KEY, EDITORIAL_JOB_SECRET.
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
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !serviceKey || !openAiKey) return json({ error: "Generator secrets are not configured" }, 500);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const startedAt = new Date().toISOString();
  let created = 0, duplicates = 0, photoCandidates = 0;
  const failures: string[] = [];
  try {
    const { data: existing, error: readError } = await supabase.from("roamsonio_editorial_destinations")
      .select("id,name,type,build_destination,metadata,created_at").limit(2000);
    if (readError) throw readError;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + openAiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        temperature: 0.8,
        messages: [
          { role: "system", content: "You are the research ideation editor for RoamSonio, a premium travel inspiration magazine. Return JSON only with a candidates array of 12 real, specific, geographically diverse travel ideas. Mix famous cities, regions, lesser-known places, activities, seasonal experiences, skiing/snowboarding, outdoors, food/culture, coast/islands and road trips. Include both US and international ideas. Never invent source URLs. Do not repeat any supplied existing names or destinations. Ideas must be real and useful for planning 3-6 months ahead as well as current season. For each candidate provide name, type (exactly one of City, Region, Ski & Snowboard, Outdoor, Coast & Island, Road Trip, Seasonal Experience), category, destination, tagline (one sentence), activities (array of strings), seasons (array of Spring, Summer, Fall, Winter), region, domesticOrInternational (Domestic or International), planningHorizon (Current season, Next season, 3-6 months, Flexible), researchNotes (short factual research query/notes). Avoid claims requiring live confirmation." },
          { role: "user", content: "Existing entries to avoid: " + JSON.stringify((existing || []).map((x: any) => ({ name: x.name, destination: x.build_destination, id: x.id }))) + ". Create a balanced new batch of candidates for the next weekly editorial edition." }
        ]
      })
    });
    const responseBody = await response.json();
    if (!response.ok) throw new Error("OpenAI candidate generation failed (" + response.status + "): " + JSON.stringify(responseBody).slice(0, 400));
    const raw = responseBody.choices?.[0]?.message?.content;
    const candidates = JSON.parse(raw || "{}").candidates;
    if (!Array.isArray(candidates)) throw new Error("AI response did not include a candidates array");

    const seen = new Set((existing || []).flatMap((x: any) => [normalized(x.name || ""), normalized(x.build_destination || ""), normalized(x.id || "")]));
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

        // Search multiple destination-specific angles to build a richer candidate pool.
        // Every photo remains unapproved; Master Admin must review fit, source, and license.
        const activityList = Array.isArray(c.activities) ? c.activities.map((x: any) => String(x)).filter(Boolean) : [];
        const activity = activityList[0] || type;
        const photoQueries = [
          destination + " " + name + " landscape",
          destination + " " + name + " village architecture",
          destination + " " + activity + " travel"
        ];
        const photoBatches = await Promise.all(photoQueries.map(async (query) => {
          try { return await commonsCandidates(query); }
          catch (e) { failures.push(name + " photo search: " + (e instanceof Error ? e.message : String(e))); return []; }
        }));
        const pool = photoBatches.flat();
        const unique = pool.filter((p: any, i: number, a: any[]) =>
          p.url && a.findIndex((q: any) => q.url === p.url) === i
        ).slice(0, 3);
        const roles = ["hero", "secondary", "mobile"];
        for (let i = 0; i < unique.length; i++) {
          const p = unique[i];
          const { error: photoError } = await supabase.from("roamsonio_editorial_photos").insert({
            destination_id: id, url: p.url, alt_text: p.alt_text, credit: p.credit,
            source_url: p.source_url, role: roles[i], sort_order: i, approved: false
          });
          if (photoError) failures.push(name + " photo: " + photoError.message);
          else photoCandidates++;
        }
        if (unique.length < 3) failures.push(name + ": only " + unique.length + " sourced photo candidates found; draft remains incomplete");
      } catch (e) {
        failures.push(String(c?.name || "candidate") + ": " + (e instanceof Error ? e.message : String(e)));
      }
    }

    const result = { startedAt, finishedAt: new Date().toISOString(), created, duplicates, photoCandidates, failures, status: failures.length ? "completed_with_warnings" : "completed", published: 0 };
    await supabase.from("roamsonio_admin_audit_log").insert({
      action: "editorial_suggestion_generation",
      details: result
    });
    return json(result);
  } catch (e) {
    const result = { startedAt, finishedAt: new Date().toISOString(), created, duplicates, photoCandidates, status: "failed", error: e instanceof Error ? e.message : String(e), failures };
    try { await supabase.from("roamsonio_admin_audit_log").insert({ action: "editorial_suggestion_generation_failed", details: result }); } catch (_) {}
    return json(result, 500);
  }
});

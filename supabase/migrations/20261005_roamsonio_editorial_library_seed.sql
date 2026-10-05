-- Initialize the documented RoamSonio Editorial Library in Supabase.
-- Idempotent: existing editorial entries with the same IDs are updated.
-- Does not modify existing trips, users, families, or saved journeys.

insert into public.roamsonio_editorial_destinations
(id,name,type,category,seasons,activities,buildable,build_destination,tagline,status,metadata)
values
("lisbon","Lisbon","City","Coast & Culture",ARRAY["Spring","Summer","Fall","Winter"],ARRAY["Walking","Cycling","Surfing","Food & Wine","Museums & Culture"],true,"Lisbon, Portugal","Golden streets, Atlantic light & late-night dinners.","draft",'{}'::jsonb),
("prague","Prague","City","Culture",ARRAY["Spring","Summer","Fall","Winter"],ARRAY["Walking","Museums & Culture","Food & Wine","Photography","Scenic Rail"],true,"Prague, Czechia","Storybook streets, grand squares & riverside evenings.","draft",'{}'::jsonb),
("kyoto","Kyoto","City","Culture & Nature",ARRAY["Spring","Fall","Winter"],ARRAY["Walking","Cycling","Hiking","Photography","Museums & Culture"],true,"Kyoto, Japan","Temples, gardens, quiet lanes & timeless beauty.","draft",'{}'::jsonb),
("new-orleans","New Orleans","City","Food & Music",ARRAY["Winter","Spring","Fall"],ARRAY["Food & Wine","Live Music","Walking","Photography","Museums & Culture"],true,"New Orleans, Louisiana, USA","Music, architecture, food & nights worth remembering.","draft",'{}'::jsonb),
("vienna","Vienna","City","Culture",ARRAY["Spring","Summer","Fall","Winter"],ARRAY["Walking","Museums & Culture","Food & Wine","Scenic Rail","Cycling"],true,"Vienna, Austria","Imperial streets, cafés, music & elegant evenings.","draft",'{}'::jsonb),
("the-alps","The Alps","Region","Mountain Adventure",ARRAY["Winter","Spring","Summer","Fall"],ARRAY["Skiing","Snowboarding","Hiking","Cycling","Scenic Rail","Climbing","Wellness & Spa"],true,"The Alps","Villages, peaks, scenic railways & mountain escapes.","draft",'{}'::jsonb),
("colorado-ski-country","Colorado Ski Country","Ski & Snowboard","Mountain Adventure",ARRAY["Winter","Spring"],ARRAY["Skiing","Snowboarding","Hiking","Mountain Biking","Climbing"],true,"Colorado Ski Country, USA","Legendary slopes, mountain towns & big Rocky Mountain views.","draft",'{}'::jsonb),
("utah-ski-country","Utah Ski Country","Ski & Snowboard","Mountain Adventure",ARRAY["Winter","Spring"],ARRAY["Skiing","Snowboarding","Hiking","Mountain Biking","Climbing"],true,"Utah Ski Country, USA","Deep snow, dramatic peaks & world-class mountain terrain.","draft",'{}'::jsonb),
("austrian-alps","Austrian Alps","Ski & Snowboard","Mountain Adventure",ARRAY["Winter","Spring","Summer","Fall"],ARRAY["Skiing","Snowboarding","Hiking","Cycling","Scenic Rail","Wellness & Spa"],true,"Austrian Alps","Alpine villages, skiing, snowboarding & classic mountain culture.","draft",'{}'::jsonb),
("dolomites","Dolomites","Region","Mountain Adventure",ARRAY["Winter","Spring","Summer","Fall"],ARRAY["Skiing","Snowboarding","Hiking","Cycling","Climbing","Photography"],true,"Dolomites, Italy","Jagged peaks, mountain huts, skiing & unforgettable drives.","draft",'{}'::jsonb),
("swiss-alps","Swiss Alps","Region","Mountain Adventure",ARRAY["Winter","Spring","Summer","Fall"],ARRAY["Skiing","Snowboarding","Hiking","Cycling","Scenic Rail","Wellness & Spa"],true,"Swiss Alps","Glacier views, alpine railways, villages & mountain trails.","draft",'{}'::jsonb),
("canadian-rockies","Canadian Rockies","Region","Outdoor",ARRAY["Summer","Fall","Winter"],ARRAY["Hiking","Skiing","Snowboarding","Wildlife","Canoeing","Photography"],true,"Canadian Rockies, Canada","Turquoise lakes, towering peaks & extraordinary wilderness.","draft",'{}'::jsonb),
("great-smoky-mountains","Great Smoky Mountains","Outdoor","Mountain Adventure",ARRAY["Spring","Summer","Fall"],ARRAY["Hiking","Wildlife","Photography","Scenic Drives","Fishing"],true,"Great Smoky Mountains, USA","Mountain roads, waterfalls, wildlife & legendary fall color.","draft",'{}'::jsonb),
("amalfi-coast","Amalfi Coast","Region","Coast & Culture",ARRAY["Spring","Summer","Fall"],ARRAY["Hiking","Sailing","Swimming","Food & Wine","Photography"],true,"Amalfi Coast, Italy","Clifftop villages, blue water & long Mediterranean lunches.","draft",'{}'::jsonb),
("santorini","Santorini","Coast & Island","Coast & Culture",ARRAY["Spring","Summer","Fall"],ARRAY["Sailing","Swimming","Hiking","Food & Wine","Photography"],true,"Santorini, Greece","Whitewashed villages, volcanic cliffs & unforgettable sunsets.","draft",'{}'::jsonb),
("scottish-highlands","Scottish Highlands","Region","Outdoor",ARRAY["Spring","Summer","Fall"],ARRAY["Hiking","Wildlife","Golf","Fishing","Road Trip","Photography"],true,"Scottish Highlands, UK","Lochs, castles, winding roads & wild landscapes.","draft",'{}'::jsonb),
("pacific-coast-highway","Pacific Coast Highway","Road Trip","Coast & Road Trip",ARRAY["Spring","Summer","Fall"],ARRAY["Road Trip","Surfing","Hiking","Photography","Food & Wine"],true,"Pacific Coast Highway, USA","Ocean cliffs, coastal towns & one unforgettable road.","draft",'{}'::jsonb),
("european-christmas-markets","European Christmas Markets","Seasonal Experience","Winter Culture",ARRAY["Winter"],ARRAY["Walking","Food & Wine","Shopping","Photography","Museums & Culture"],true,"Central Europe Christmas Markets","Old-world squares, lights, markets & winter evenings.","draft",'{}'::jsonb),
("oktoberfest","Oktoberfest","Seasonal Experience","Food & Culture",ARRAY["Fall"],ARRAY["Food & Wine","Live Music","Walking","Museums & Culture"],true,"Munich, Germany","Bavarian traditions, music, food & one legendary celebration.","draft",'{}'::jsonb),
("northern-lights","Northern Lights","Seasonal Experience","Outdoor",ARRAY["Fall","Winter","Spring"],ARRAY["Wildlife","Photography","Hiking","Snowshoeing","Scenic Rail"],true,"Northern Europe","Dark skies, winter landscapes & nature's greatest light show.","draft",'{}'::jsonb),
("banff","Banff & Lake Louise","Outdoor","Mountain Adventure",ARRAY["Summer","Fall","Winter","Spring"],ARRAY["Hiking","Skiing","Snowboarding","Wildlife","Canoeing","Photography"],true,"Banff & Lake Louise, Alberta, Canada","Glacial lakes, mountain trails, wildlife & alpine adventures.","draft",'{}'::jsonb),
("hawaii","Hawaii","Coast & Island","Coast & Water",ARRAY["Winter","Spring","Summer","Fall"],ARRAY["Surfing","Sailing","Scuba Diving","Hiking","Wildlife","Golf"],true,"Hawaii, USA","Volcanic landscapes, warm water, beaches & island adventures.","draft",'{}'::jsonb),
("utah-national-parks","Utah National Parks","Road Trip","Outdoor",ARRAY["Spring","Summer","Fall"],ARRAY["Hiking","Photography","Road Trip","Climbing","Wildlife"],true,"Utah National Parks, USA","Red-rock canyons, scenic drives, trails & unforgettable skies.","draft",'{}'::jsonb),
("patagonia","Patagonia","Region","Outdoor",ARRAY["Spring","Summer","Fall"],ARRAY["Hiking","Wildlife","Photography","Climbing","Fishing"],true,"Patagonia, Chile & Argentina","Glaciers, dramatic peaks, wild trails & extraordinary wilderness.","draft",'{}'::jsonb),
("tuscany","Tuscany","Region","Food & Culture",ARRAY["Spring","Summer","Fall"],ARRAY["Food & Wine","Cycling","Golf","Photography","Museums & Culture","Road Trip"],true,"Tuscany, Italy","Hill towns, vineyards, art, long lunches & scenic drives.","draft",'{}'::jsonb),
("french-alps","French Alps","Ski & Snowboard","Mountain Adventure",ARRAY["Winter","Spring","Summer","Fall"],ARRAY["Skiing","Snowboarding","Hiking","Cycling","Climbing","Wellness & Spa"],true,"French Alps","High mountain terrain, village life, skiing & summer trails.","draft",'{}'::jsonb)
on conflict (id) do update set
  name=excluded.name,
  type=excluded.type,
  category=excluded.category,
  seasons=excluded.seasons,
  activities=excluded.activities,
  buildable=excluded.buildable,
  build_destination=excluded.build_destination,
  tagline=excluded.tagline,
  status=excluded.status,
  metadata=excluded.metadata,
  updated_at=now();

notify pgrst, 'reload schema';

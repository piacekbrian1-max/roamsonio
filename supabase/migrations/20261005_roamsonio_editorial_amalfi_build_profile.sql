-- Add the first rich Editorial Library build profile.
-- Safe: updates only the published Amalfi Coast editorial row's metadata.
-- Does not modify users, families, trips, or saved journeys.

update public.roamsonio_editorial_destinations
set metadata = '{
  "areas": [
    "Positano",
    "Amalfi",
    "Ravello",
    "Atrani",
    "Praiano",
    "Furore",
    "Conca dei Marini",
    "Minori & Maiori",
    "Cetara",
    "Vietri sul Mare"
  ],
  "sights": [
    "Positano village and Spiaggia Grande",
    "Path of the Gods (Sentiero degli Dei)",
    "Amalfi Cathedral and Piazza del Duomo",
    "Amalfi paper museum (Museo della Carta)",
    "Atrani historic center and Piazza Umberto I",
    "Ravello and Villa Rufolo",
    "Villa Cimbrone and Terrace of Infinity",
    "Furore Fjord",
    "Praiano and Marina di Praia",
    "Conca dei Marini and Emerald Grotto",
    "Fiordo di Furore coastal viewpoint",
    "Valle delle Ferriere nature reserve",
    "Valle dei Mulini in Amalfi",
    "Maiori waterfront",
    "Minori and Roman Villa",
    "Cetara fishing village",
    "Vietri sul Mare ceramics district",
    "Amalfi Coast scenic drive",
    "Amalfi Coast coastal boat excursion",
    "Capri day trip",
    "Pompeii day trip",
    "Naples historic-center day trip",
    "Sunset viewpoint above Positano",
    "Lemon terraces and coastal farm visit"
  ],
  "food": [
    "Da Vincenzo Positano",
    "La Tagliata",
    "Chez Black",
    "Il Tridente",
    "La Sponda",
    "Marina Grande",
    "Eolo",
    "Ristorante Marina Grande Amalfi",
    "Pizzeria Donna Stella",
    "La Caravella",
    "Cumpa' Cosimo",
    "Trattoria da Gemma"
  ],
  "local": [
    "Positano boutiques and artisan sandal shops",
    "Amalfi paper-making tradition",
    "Ravello gardens and classical-music heritage",
    "Cetara fishing and anchovy tradition",
    "Vietri ceramics",
    "Lemon terraces and limoncello tradition",
    "Amalfi waterfront and Piazza del Duomo"
  ],
  "events": "Amalfi Coast seasonal events and local festivals",
  "weather": "Amalfi Coast, Italy weather",
  "cams": "Amalfi Coast, Italy live webcam",
  "resources": [
    "https://www.italia.it/en/campania/amalfi-coast",
    "https://whc.unesco.org/en/list/830/",
    "https://www.capri.com/en/",
    "https://pompeiisites.org/en/",
    "https://www.parconazionaledelvesuvio.it/"
  ]
}'::jsonb,
updated_at=now()
where id='amalfi-coast' and status='published';

notify pgrst, 'reload schema';

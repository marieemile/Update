// Source registry. Tier drives how much a source can establish vs. merely surface:
//   1 = primary (governments, institutions, companies, journals)
//   2 = established journalism
//   3 = specialist publications
//   4 = discovery only (forums, aggregators) - never enough on its own to establish a fact
// Reuters, AP, Bloomberg and WSJ no longer publish open RSS feeds, so they are
// not listed; add any feed you have access to here. FT, NYT and Law360 articles
// are paywalled, but their feeds carry headlines and summaries.

// Google News search feed. Items carry the real publisher, which ingest uses as
// the source name; "when:Nd" limits results to the last N days.
function googleNews(query, lang = "pt-PT", country = "PT") {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${country}&ceid=${country}:${lang.split("-")[0]}`;
}

// Portuguese-language searches also surface Brazilian outlets; skip them by
// publisher domain.
const BRAZIL = /\.br$|^(valor\.globo|oglobo\.globo|exame|cnnbrasil|investidor10)\.com|vietnam\.vn$/;

export const SOURCES = [
  // ---- World: primary ----
  { name: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", tier: 1, domain: "world" },
  { name: "WHO", url: "https://www.who.int/rss-feeds/news-english.xml", tier: 1, domain: "world" },
  { name: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", tier: 1, domain: "world" },
  { name: "European Central Bank", url: "https://www.ecb.europa.eu/rss/press.html", tier: 1, domain: "world" },
  { name: "NASA", url: "https://www.nasa.gov/news-release/feed/", tier: 1, domain: "world" },
  { name: "Nature", url: "https://www.nature.com/nature.rss", tier: 1, domain: "world" },
  { name: "European Commission", url: "https://ec.europa.eu/commission/presscorner/api/rss?language=en", tier: 1, domain: "world" },

  // ---- World: journalism ----
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", tier: 2, domain: "world" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", tier: 2, domain: "world" },
  { name: "The Guardian World", url: "https://www.theguardian.com/world/rss", tier: 2, domain: "world" },
  { name: "The Guardian Environment", url: "https://www.theguardian.com/environment/rss", tier: 2, domain: "world" },
  { name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml", tier: 2, domain: "world" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", tier: 2, domain: "world" },
  { name: "DW", url: "https://rss.dw.com/rdf/rss-en-world", tier: 2, domain: "world" },
  { name: "Politico Europe", url: "https://www.politico.eu/feed/", tier: 2, domain: "world" },
  { name: "Financial Times World", url: "https://www.ft.com/world?format=rss", tier: 2, domain: "world" },
  { name: "New York Times World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", tier: 2, domain: "world" },
  { name: "Semafor", url: "https://www.semafor.com/rss.xml", tier: 2, domain: "world" },
  { name: "Euronews", url: "https://www.euronews.com/rss", tier: 2, domain: "world" },
  { name: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", tier: 2, domain: "world" },
  { name: "The Hindu International", url: "https://www.thehindu.com/news/international/feeder/default.rss", tier: 2, domain: "world" },

  // ---- World: specialist / positive ----
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml", tier: 3, domain: "world" },
  { name: "Carbon Brief", url: "https://www.carbonbrief.org/feed/", tier: 3, domain: "world" },
  { name: "Positive News", url: "https://www.positive.news/feed/", tier: 3, domain: "world" },
  { name: "STAT News", url: "https://www.statnews.com/feed/", tier: 3, domain: "world" },
  { name: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/", tier: 3, domain: "world" },

  // ---- Tech: primary ----
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", tier: 1, domain: "tech" },
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", tier: 1, domain: "tech" },
  { name: "Microsoft", url: "https://blogs.microsoft.com/feed/", tier: 1, domain: "tech" },
  { name: "NVIDIA", url: "https://blogs.nvidia.com/feed/", tier: 1, domain: "tech" },
  { name: "Apple Newsroom", url: "https://www.apple.com/newsroom/rss-feed.rss", tier: 1, domain: "tech" },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", tier: 1, domain: "tech" },

  // ---- Tech: journalism ----
  { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", tier: 2, domain: "tech" },
  { name: "The Guardian Technology", url: "https://www.theguardian.com/uk/technology/rss", tier: 2, domain: "tech" },
  { name: "Financial Times Technology", url: "https://www.ft.com/technology?format=rss", tier: 2, domain: "tech" },

  // ---- Tech: specialist ----
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", tier: 3, domain: "tech" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", tier: 3, domain: "tech" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", tier: 3, domain: "tech" },
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", tier: 3, domain: "tech" },
  { name: "Wired", url: "https://www.wired.com/feed/rss", tier: 3, domain: "tech" },
  { name: "404 Media", url: "https://www.404media.co/rss/", tier: 3, domain: "tech" },
  { name: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/feed.rss", tier: 3, domain: "tech" },
  { name: "The Register", url: "https://www.theregister.com/headlines.atom", tier: 3, domain: "tech" },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", tier: 3, domain: "tech" },
  { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", tier: 3, domain: "tech" },
  { name: "The Record", url: "https://therecord.media/feed", tier: 3, domain: "tech" },
  { name: "Rest of World", url: "https://restofworld.org/feed/latest", tier: 3, domain: "tech" },
  { name: "SpaceNews", url: "https://spacenews.com/feed/", tier: 3, domain: "tech" },

  // ---- Market: Intellectual Property ----
  { name: "WIPO", url: "https://www.wipo.int/pressroom/en/rss.xml", tier: 1, domain: "world", market: "ip" },
  { name: "European Patent Office", url: "https://www.epo.org/en/rss.xml", tier: 1, domain: "world", market: "ip" },
  { name: "Law360 IP", url: "https://www.law360.com/ip/rss", tier: 2, domain: "tech", market: "ip" },
  { name: "IAM", url: "https://www.iam-media.com/rss", tier: 3, domain: "tech", market: "ip" },
  { name: "World Trademark Review", url: "https://www.worldtrademarkreview.com/rss", tier: 3, domain: "world", market: "ip" },
  { name: "JUVE Patent", url: "https://www.juve-patent.com/feed/", tier: 3, domain: "tech", market: "ip" },
  { name: "Patently-O", url: "https://patentlyo.com/feed", tier: 3, domain: "tech", market: "ip" },
  { name: "IPKat", url: "https://ipkitten.blogspot.com/feeds/posts/default?alt=rss", tier: 3, domain: "world", market: "ip" },
  { name: "TorrentFreak", url: "https://torrentfreak.com/feed/", tier: 3, domain: "tech", market: "ip" },
  { name: "IPFray", url: "https://ipfray.com/feed/", tier: 3, domain: "tech", market: "ip" },

  // ---- Market: Real Estate (Europe, with a Portugal focus) ----
  // Most Portuguese property outlets (idealista, Vida Imobiliária, Jornal de
  // Negócios, Expresso) block or don't publish feeds, so Google News searches
  // fill the gap. Ingest names each of their items after the real publisher.
  { name: "ECO Imobiliário", url: "https://eco.sapo.pt/topico/imobiliario/feed/", tier: 2, domain: "world", market: "real_estate" },
  { name: "ECO Habitação", url: "https://eco.sapo.pt/topico/habitacao/feed/", tier: 2, domain: "world", market: "real_estate" },
  { name: "Housing Europe", url: "https://www.housingeurope.eu/rss", tier: 3, domain: "world", market: "real_estate" },
  { name: "PT housing law", url: googleNews("lei habitação OR arrendamento OR \"alojamento local\" OR IMT OR IMI OR \"crédito habitação\" OR \"Diário da República\" imóveis when:2d"), skipPublishers: BRAZIL, tier: 3, domain: "world", market: "real_estate" },
  { name: "PT property market", url: googleNews("imobiliário OR \"preço das casas\" OR \"mercado imobiliário\" when:2d"), skipPublishers: BRAZIL, tier: 3, domain: "world", market: "real_estate" },
  { name: "Portugal property (EN)", url: googleNews("Portugal (property OR \"real estate\" OR housing OR rental OR landlords) -Ronaldo -football -\"for sale\" when:2d", "en-GB", "GB"), tier: 3, domain: "world", market: "real_estate" },
  { name: "EU housing policy", url: googleNews("EU housing OR \"Affordable Housing\" OR \"short-term rentals\" OR \"real estate\" regulation Europe when:3d", "en-GB", "GB"), tier: 3, domain: "world", market: "real_estate" },
  { name: "PropTech Europe", url: googleNews("proptech OR \"property platform\" OR \"real estate\" AI tool Europe OR Portugal OR Spain when:7d", "en-GB", "GB"), tier: 3, domain: "tech", market: "real_estate" },
  { name: "PropTech PT", url: googleNews("proptech OR \"plataforma imobiliária\" OR \"startup imobiliária\" OR \"inteligência artificial\" imobiliário when:7d"), skipPublishers: BRAZIL, tier: 3, domain: "tech", market: "real_estate" },

  // ---- Discovery ----
  { name: "Hacker News (200+ points)", url: "https://hnrss.org/frontpage?points=200", tier: 4, domain: "tech" },
  { name: "Techmeme", url: "https://www.techmeme.com/feed.xml", tier: 4, domain: "tech" },
];

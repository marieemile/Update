// Source registry. Tier drives how much a source can establish vs. merely surface:
//   1 = primary (governments, institutions, companies, journals)
//   2 = established journalism
//   3 = specialist publications
//   4 = discovery only (forums, aggregators) - never enough on its own to establish a fact
// Reuters, AP, FT, Bloomberg and WSJ no longer publish open RSS feeds, so they are
// not listed; add any feed you have access to here.

export const SOURCES = [
  // ---- World: primary ----
  { name: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", tier: 1, domain: "world" },
  { name: "WHO", url: "https://www.who.int/rss-feeds/news-english.xml", tier: 1, domain: "world" },
  { name: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", tier: 1, domain: "world" },
  { name: "European Central Bank", url: "https://www.ecb.europa.eu/rss/press.html", tier: 1, domain: "world" },
  { name: "NASA", url: "https://www.nasa.gov/news-release/feed/", tier: 1, domain: "world" },
  { name: "Nature", url: "https://www.nature.com/nature.rss", tier: 1, domain: "world" },

  // ---- World: journalism ----
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", tier: 2, domain: "world" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", tier: 2, domain: "world" },
  { name: "The Guardian World", url: "https://www.theguardian.com/world/rss", tier: 2, domain: "world" },
  { name: "The Guardian Environment", url: "https://www.theguardian.com/environment/rss", tier: 2, domain: "world" },
  { name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml", tier: 2, domain: "world" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", tier: 2, domain: "world" },
  { name: "DW", url: "https://rss.dw.com/rdf/rss-en-world", tier: 2, domain: "world" },
  { name: "Politico Europe", url: "https://www.politico.eu/feed/", tier: 2, domain: "world" },

  // ---- World: specialist / positive ----
  { name: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml", tier: 3, domain: "world" },
  { name: "Carbon Brief", url: "https://www.carbonbrief.org/feed/", tier: 3, domain: "world" },
  { name: "Positive News", url: "https://www.positive.news/feed/", tier: 3, domain: "world" },

  // ---- Tech: primary ----
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", tier: 1, domain: "tech" },
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", tier: 1, domain: "tech" },
  { name: "Microsoft", url: "https://blogs.microsoft.com/feed/", tier: 1, domain: "tech" },
  { name: "NVIDIA", url: "https://blogs.nvidia.com/feed/", tier: 1, domain: "tech" },
  { name: "Apple Newsroom", url: "https://www.apple.com/newsroom/rss-feed.rss", tier: 1, domain: "tech" },

  // ---- Tech: journalism ----
  { name: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", tier: 2, domain: "tech" },
  { name: "The Guardian Technology", url: "https://www.theguardian.com/uk/technology/rss", tier: 2, domain: "tech" },

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

  // ---- Discovery ----
  { name: "Hacker News (200+ points)", url: "https://hnrss.org/frontpage?points=200", tier: 4, domain: "tech" },
];

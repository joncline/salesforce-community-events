#!/usr/bin/env node

/**
 * Salesforce Community Events - CFP and Ticket Sales Status Checker
 *
 * This script checks the status of Call for Presenters/Speakers and ticket sales
 * for all Salesforce community events and updates the Events Overview Table in README.md file.
 *
 * Run: node check-cfp-status.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Event configuration - Events are fetched dynamically from Salesforce API
let EVENTS = [];

// Cross-reference URLs for discovering events not yet in our list
const CROSS_REFERENCE_URLS = [
  'https://ascendix.com/blog/salesforce-events-conferences/',
  'https://lifesciencesdreamin.com/',
  'https://www.salesforce.com/connections/',
  'https://montrealdreamin.com/',
  'https://dreaminincolor.com/',
  'https://www.linkedin.com/company/women-in-tech-dreamin/',
  'https://kiwidreaming.nz/',
  // Official Trailblazer Community conferences list (verified 2026-11-04 against a
  // full regen — all dated rows matched). The page is a JS-rendered Gatsby shell:
  // a plain fetch returns 1MB of framework HTML with zero event names, so it is
  // fetched through the r.jina.ai reader (renders JS, returns a markdown table).
  // Kept LAST: slowest call. r.jina.ai rate-limits rapid-fire calls — there is one
  // call per run here, fine; don't loop it quickly.
  'https://r.jina.ai/https://trailhead.salesforce.com/community/conferences/'
];

// Curated overrides keyed by exact (apostrophe-normalized) event name.
// These SURVIVE flaky fetches: if a site times out or scraping misses a link, the
// values here are still written, preventing the false-negative TBDs that wipe good
// data on every run (the README is fully regenerated each run, so anything not
// reproduced here is lost). Add an entry whenever the table loses a known-good link.
const EVENT_OVERRIDES = {
  "Cactusforce 2027": {
    date: "January 21-22, 2027",
    cfpUrl: "https://www.cactusforce.com/submit-a-talk",
    ticketUrl: "https://www.cactusforce.com/register",
    sponsorUrl: "https://www.cactusforce.com/sponsor"
  },
  "Irish Dreamin'": {
    cfpUrl: "https://irishdreamin.ie/call-for-speakers/",
    ticketUrl: "https://irishdreamin.ie/book-tickets/",
    sponsorUrl: "https://irishdreamin.ie/sponsor-interest/"
  },
  "Yeur Architect Dreamin 2026": {
    name: "Architect Dreamin' Europe",
    location: "Helsinki, Finland",
    cfpUrl: "https://architectdreamin.com/call-for-participation/"
  },
  "Portugal Dreamin' 2026": {
    url: "https://www.portugaldreamin.com/en",
    ticketUrl: "https://www.portugaldreamin.com/en/register",
    sponsorUrl: "https://www.portugaldreamin.com/en/sponsors"
  },
  "Japan Dreamin' 2026": {
    url: "https://www.japandreamin.com/event/s/"
  },
  "Finnish Dreamin' 2026": {
    url: "https://finnishdreamin.fi/",
    cfpUrl: "https://finnishdreamin.fi/call-for-speakers",
    ticketUrl: "https://finnishdreamin.fi/tickets",
    sponsorUrl: "https://finnishdreamin.fi/sponsors"
  },
  "MC² 2026": {
    url: "https://mcsquare.co.in/",
    date: "May 16, 2026",
    location: "Bengaluru, India",
    sponsorUrl: "https://mcsquare.co.in/sponsors/"
  },
  "MC² 2027": {  // the May 2026 edition rolls forward to this once the date passes
    url: "https://mcsquare.co.in/",
    sponsorUrl: "https://mcsquare.co.in/sponsors/"
  },
  "Higher Ed Dreamin': Marketing Edition 2026": {
    date: "June 2, 2026",  // Fix date to match RingCentral event page
    ticketUrl: "https://events.ringcentral.com/events/higher-ed-dreamin-marketing-edition"
  },
  "Life Sciences Dreamin' 2026": {
    url: "https://lifesciencesdreamin.com/"
  },
  "Connections 2026": {
    url: "https://www.salesforce.com/connections/"
  },
  "Montreal Dreamin' 2026": {
    url: "https://montrealdreamin.com/"
  },
  "Dreamin in Color 2026": {
    url: "https://dreaminincolor.com/"
  },
  "WIT Dreamin' 2026": {
    url: "https://www.linkedin.com/company/women-in-tech-dreamin/"
  },
  "Nonprofit Dreamin' 2026": {
    url: "https://www.nonprofitdreamin.org/",
    location: "Charlotte, North Carolina, USA"
  },
  "Nonprofit Dreamin' 2027": {
    url: "https://www.nonprofitdreamin.org/",
    location: "TBD"
  },
  "True Blue Blazing Melbourne 2026": {
    cfpUrl: "https://trueblueblazing.com/speakers-expression-of-interest/",
    ticketUrl: "https://trueblueblazing.com/tickets",
    sponsorUrl: "https://trueblueblazing.com/sponsorship-opportunities/"
  },
  "West Africa Dreamin' 2026": {
    url: "https://westafricadreamin.com/",  // API returns a bare, unlinkable "Westafricadreamin.com"
    cfpUrl: "https://westafricadreamin.my.site.com/s/register-speaker",
    sponsorUrl: "https://westafricadreamin.my.site.com/s/register-sponsor"
  },
  "Cairo Dreamin' 2027": {
    sponsorUrl: "https://www.cairodreamin.com/sponsors/"
  },
  "Forcelandia 2026": {
    date: "July 29-30, 2026",
    ticketUrl: "https://www.eventbrite.com/e/forcelandia-2026-tickets-1988583489749",
    sponsorUrl: "https://forcelandia.com/2026-sponsors/"
  },
  "Polish Dreamin' 2027": {
    date: "April 16, 2027",
    location: "Wroclaw, Poland"
  },
  // 2026-11-04 run fixes (each verified against the event site / announcements).
  // Seoul's real date is Nov 11, 2026 (Trailhead calendar + official LinkedIn
  // announcement) — the API feed is off by one day.
  "Seoul Dreamin' 2026": {
    date: "November 11, 2026"
  },
  // Site confirms May 28, 2027; the API lists the event twice (with and without
  // the apostrophe) and once with a wrong May 27 date — pin both name variants
  // to one correct row; the rename makes dedupe collapse them.
  "CzechDreamin' 2027": {
    date: "May 28, 2027"
  },
  "CzechDreamin 2027": {
    name: "CzechDreamin' 2027",
    date: "May 28, 2027"
  },
  // API lists the same event twice: the dated architectdreamin.us row plus a
  // stale TBD row on the misspelled architectdreaming.us domain. Rename so
  // dedupe collapses them (higher score keeps the dated row's data).
  "Architect Dreamin US 2027": {
    name: "Architect Dreamin' Americas 2027"
  },
  // API returns lowercase month names for these events; corrected date format.
  "True North Dreamin' 2027": {
    date: "April 6-7, 2027",  // site-verified
    url: "https://www.truenorthdreamin.com/"  // scrape otherwise returns a scheme-less copy
  },
  "Buckeye Dreamin' 2027": {
    date: "July 20-22, 2027"
  },
  "Northeast Dreamin' 2027": {
    date: "October 12-13, 2027"
  },
  // Site URL was scraped without a scheme ("biggestlittledreamin.com")
  "Biggest Little Dreamin' 2027": {
    url: "https://biggestlittledreamin.com/"
  },
  // API 2027 record appears intermittently; its URL comes back scheme-less from the scrape.
  "Mile High Dreamin' 2027": {
    url: "https://www.milehighdreamin.com/"
  },
  // Site sponsor href is a mailto joined onto the domain ("fldreamin.commailto:…");
  // pin the full mailto from the site.
  "Florida Dreamin' 2027": {
    sponsorUrl: "mailto:michelle@fldreamin.com?subject=2027%20Sponsor%20Interest&body=Company%20Name%3A%0ACompany%20Email%3A%0A%0AComments%3A"
  },
  // The API now feeds Portugal 2027 natively (June 19, 2027); a rolled 2026
  // placeholder competes for the same normalized name — pin the date so either
  // surviving row keeps it.
  "Portugal Dreamin' 2027": {
    date: "June 19, 2027",
    url: "https://www.portugaldreamin.com/en",
    sponsorUrl: "https://www.portugaldreamin.com/en/sponsors"
  },

  // Announced 2026-11-04 (owner).
  "Wir sind Ohana 2027": {
    date: "April 23, 2027"
  }
};

// Fetch URL content with timeout
function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SFEventChecker/1.0)'
      },
      timeout: timeout
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        return fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject).on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    // Set timeout on the request
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
  });
}

// Parse date string to Date object for sorting
function parseEventDate(dateStr) {
  if (!dateStr || dateStr === 'TBD') {
    return new Date('9999-12-31'); // Put TBD dates at the end
  }

  try {
    // Handle date ranges - extract the start date
    let cleanDate = dateStr;
    
    // Handle ranges like "July 8-9, 2026" or "March 24-26, 2026"
    if (dateStr.includes('-') && !dateStr.includes(' - ')) {
      const match = dateStr.match(/^(\w+)\s+(\d+)-(\d+),\s*(\d{4})$/);
      if (match) {
        cleanDate = `${match[1]} ${match[2]}, ${match[4]}`;
      }
    }
    
    // Handle ranges like "July 8 - August 9, 2026"
    if (dateStr.includes(' - ')) {
      const parts = dateStr.split(' - ');
      cleanDate = parts[0];
    }
    
    const parsed = new Date(cleanDate + ' UTC');
    if (isNaN(parsed.getTime())) {
      return new Date('9999-12-31');
    }
    return parsed;
  } catch (e) {
    return new Date('9999-12-31');
  }
}

// Sort events by date ascending (earliest first), starting from current date
function sortEventsByDate(events, currentDate = new Date()) {
  return events.sort((a, b) => {
    const dateA = parseEventDate(a.date);
    const dateB = parseEventDate(b.date);
    
    // If both dates are valid, sort ascending
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA.getTime() - dateB.getTime();
    }
    
    // If dates are equal, maintain original order
    return 0;
  });
}

// Fetch events from Salesforce API
async function fetchEventsFromAPI() {
  const apiUrl = 'https://drm.my.salesforce-sites.com/eventsapp/services/apexrest/communities/events';
  const result = await fetchUrl(apiUrl);
  if (result.statusCode !== 200) {
    throw new Error(`Failed to fetch events: ${result.statusCode}`);
  }
  const events = JSON.parse(result.body);

  // Filter to 2026 and 2027 events, map to our format
  const filteredEvents = events.filter(event => {
    const year = new Date(event.start_date).getUTCFullYear();
    return year === 2026 || year === 2027;
  }).map(event => {
    // Format date. The API stores midnight-UTC dates: render in UTC — local-time
    // rendering shifted every event one day earlier on America/Los_Angeles machines
    // (site-verified 2026-11-04: Seoul Nov 11, Pakistan Nov 7, Irish Mar 19,
    // Architect Dreamin' Americas Feb 9-10, WITness/Texas Jul 15-16, …).
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    const startMonth = startDate.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    const endMonth = endDate.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    const startDay = startDate.getUTCDate();
    const endDay = endDate.getUTCDate();
    const year = startDate.getUTCFullYear();

    let date;
    if (startMonth === endMonth && startDay === endDay) {
      date = `${startMonth} ${startDay}, ${year}`;
    } else if (startMonth === endMonth) {
      date = `${startMonth} ${startDay}-${endDay}, ${year}`;
    } else {
      date = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }

    // Location
    const location = `${event.city || ''}, ${event.country || ''}`.replace(/^, /, '').replace(/, $/, '');

    return {
      name: event.title,
      date,
      location,
      url: event.website_url,
      // Add other fields if available, but for now keep minimal
    };
  });

  // Apply curated overrides (shared with checkEvent) and prepare events.
  // Normalize the lookup key so fancy-apostrophe API titles still match.
  const eventsWithOverrides = filteredEvents.map(event => {
    const override = EVENT_OVERRIDES[normalizeEventName(event.name)];
    if (override) {
      return { ...event, ...override };
    }
    return event;
  });

  return eventsWithOverrides;
}

// Sort events by date and split into future / past-converted-to-next-year / unknown buckets.
// Manual events and API events go through the same pipeline so they interleave by date.
function categorizeAndSortEvents(events) {
  const sortedEvents = sortEventsByDate(events);

  const futureEvents = [];
  const pastEvents = [];
  const unknownEvents = [];

  const now = new Date();

  sortedEvents.forEach(event => {
    const hasValidUrl = event.url && event.url !== 'TBD' && !event.url.includes('example.com') && !event.url.includes('placeholder');

    if (!hasValidUrl) {
      unknownEvents.push({ ...event, url: 'TBD', isPast: false });
      return;
    }

    // Events with a TBD date can't be classified as past/future — treat as unknown ordering-wise.
    if (!event.date || event.date === 'TBD') {
      unknownEvents.push({ ...event, isPast: false });
      return;
    }

    let endDateStr = event.date;

    if (event.date.includes(' - ')) {
      const parts = event.date.split(' - ');
      if (parts.length === 2) {
        endDateStr = parts[1];
      }
    } else if (event.date.includes('-')) {
      const match = event.date.match(/(\w+ \d+)-(\d+), (\d+)/);
      if (match) {
        endDateStr = `${match[1].split(' ')[0]} ${match[2]}, ${match[3]}`;
      }
    }

    const endDate = new Date(endDateStr + ' UTC');
    const isPast = endDate < now;

    if (isPast) {
      const nextYearEvent = {
        ...event,
        // The rolled placeholder is a NEXT-YEAR event: never carry the original
        // date forward — it is last year's date. It starts TBD, and only an
        // override or the site scrape may fill a real next-year date in.
        date: 'TBD',
        name: event.name.replace(/(\d{4})/, (match) => (parseInt(match) + 1).toString()),
        isPast: true,
        originalYear: event.name.match(/(\d{4})/)?.[1] || '2026'
      };
      pastEvents.push(nextYearEvent);
    } else {
      futureEvents.push({ ...event, isPast: false });
    }
  });

  return [...futureEvents, ...pastEvents, ...unknownEvents];
}

// Remove duplicate rows that creep in when the API and the manual list (or two API
// records) describe the same event under slightly different spelling/casing — e.g.
// "Dreamin' In Color" vs "Dreamin' in Color", or a stray repeated Polish Dreamin' row.
// Dedupe on the apostrophe-normalized, lower-cased name. The YEAR is kept in the key,
// so 2026/2027 editions remain separate rows; only same-year duplicates collapse.
// When two copies collide we keep whichever carries the most real (non-TBD) data.
function dedupeEvents(events) {
  const isReal = (v) => v && v !== 'TBD' && !/example\.com|placeholder/.test(v);
  const score = (e) => {
    let s = 0;
    if (isReal(e.date)) s++;
    if (isReal(e.location)) s++;
    if (isReal(e.url) && e.url.startsWith('http')) s++;  // absolute links beat bare "foo.com"
    if (e.cfpUrl) s++;
    if (e.ticketUrl) s++;
    if (e.sponsorUrl) s++;
    return s;
  };

  const byKey = new Map();  // insertion order preserved → keeps the sorted ordering
  for (const event of events) {
    const key = normalizeEventName(event.name).toLowerCase().replace(/\s+/g, ' ').trim();
    const existing = byKey.get(key);
    if (!existing || score(event) > score(existing)) {
      byKey.set(key, event);
    }
  }
  return Array.from(byKey.values());
}

// Normalize event name for comparison (replace fancy apostrophes with regular ones)
function normalizeEventName(name) {
  return name.replace(/[\u2018\u2019\u201B]/g, "'");
}

// Apply overrides to event before checking
function applyOverrides(event) {
  const override = EVENT_OVERRIDES[normalizeEventName(event.name)];
  if (override) {
    return { ...event, ...override };
  }
  return event;
}

// Check if website is active and look for CFP and ticket sales links
async function checkEvent(event) {
  // Apply overrides first - before any website checking
  event = applyOverrides(event);

  // Skip website checking for events with TBD URLs
  if (event.url === 'TBD') {
    return {
      ...event,
      status: event.isPast ? 'past' : 'pending',
      cfpStatus: 'TBD',
      ticketStatus: 'TBD',
      sponsorStatus: 'TBD'
    };
  }

  // Handle past events (converted to next year potential events)
  if (event.isPast) {
    try {
      const result = await fetchUrl(event.url);

      if (result.statusCode !== 200) {
        // Preserve curated override links even when the site is unreachable —
        // otherwise a rolled-forward event silently loses its known sponsor/CFP links.
        return {
          ...event,
          status: 'pending',
          cfpStatus: event.cfpUrl ? `[OPEN](${event.cfpUrl})` : 'TBD',
          ticketStatus: event.ticketUrl ? `[Buy Tickets](${event.ticketUrl})` : 'TBD',
          sponsorStatus: event.sponsorUrl ? `[Become a Sponsor](${event.sponsorUrl})` : 'TBD',
          date: (event.date && event.date !== 'TBD') ? event.date : 'TBD',
          location: 'TBD'
        };
      }

      const body = result.body.toLowerCase();

      // Look for next year information (2027+)
      const nextYear = parseInt(event.originalYear || '2026') + 1;
      const nextYearPattern = new RegExp(nextYear.toString());

      const hasNextYearInfo = nextYearPattern.test(body);

      let date = 'TBD';
      let location = 'TBD';
      let cfpStatus = 'TBD';
      let ticketStatus = 'TBD';

      if (hasNextYearInfo) {
        // Try to extract next year date information
        const datePatterns = [
          // Match patterns like "March 15-16, 2027" or "March 2027"
          new RegExp(`(${nextYear})\\s*([A-Za-z]+\\s+\\d+(?:-\\d+)?(?:,\\s*${nextYear})?)`, 'i'),
          new RegExp(`([A-Za-z]+\\s+\\d+(?:-\\d+)?),?\\s*(${nextYear})`, 'i')
        ];

        for (const pattern of datePatterns) {
          const dateMatch = body.match(pattern);
          if (dateMatch) {
            // Clean up the matched date
            const matchedDate = dateMatch[0].replace(/\s+/g, ' ').trim();
            if (matchedDate.length > 4) { // Make sure we captured more than just the year
              date = matchedDate;
              break;
            }
          }
        }

        // Try to extract location information near the next year mention
        const locationPatterns = [
          /(?:in|at)\s+([A-Za-z\s,]+?)(?:\s+(?:on|from|in\s+${nextYear}|\d{4})|$)/i,
          /([A-Za-z\s,]+?)(?:\s+(?:on|from|in\s+${nextYear}|\d{4})|$)/i
        ];

        // Look for location in context around next year mentions
        const nextYearIndex = body.indexOf(nextYear.toString());
        if (nextYearIndex !== -1) {
          const contextStart = Math.max(0, nextYearIndex - 200);
          const contextEnd = Math.min(body.length, nextYearIndex + 200);
          const context = body.substring(contextStart, contextEnd);

          for (const pattern of locationPatterns) {
            const locationMatch = context.match(pattern);
            if (locationMatch && locationMatch[1].trim().length > 3) {
              location = locationMatch[1].trim();
              break;
            }
          }
        }

        // Check for CFP and ticket mentions for next year
        const hasNextYearCFP = nextYearPattern.test(body) && (
          body.includes('call for speakers') ||
          body.includes('call for presenters') ||
          body.includes('submit a session') ||
          body.includes('speaker submission') ||
          body.includes('cfp')
        );

        const hasNextYearTickets = nextYearPattern.test(body) && (
          body.includes('tickets') ||
          body.includes('register') ||
          body.includes('buy tickets')
        );

        if (hasNextYearCFP) cfpStatus = 'TBD'; // Will be determined when date is known
        if (hasNextYearTickets) ticketStatus = 'TBD'; // Will be determined when date is known
      }

      // An explicit override/known date (applied at checkEvent start) beats the
      // scraped page text; the page body is lower-cased, so scraped dates render
      // lowercase ("may 28, 2027") — title-case them for the table format.
      if (event.date && event.date !== 'TBD') {
        date = event.date;
      } else if (date !== 'TBD') {
        date = date.replace(/^[a-z]/, c => c.toUpperCase());
      }

      // Check for sponsor opportunities (these might still be relevant)
      const sponsorKeywords = [
        'sponsor',
        'sponsorship',
        'become a sponsor',
        'sponsor us',
        'partnership'
      ];

      const hasSponsor = sponsorKeywords.some(keyword => body.includes(keyword));

      let sponsorStatus = 'TBD';
      if (hasSponsor) {
        // Try to extract sponsor link
        const sponsorLinkMatch = body.match(/href=["']([^"']*(?:sponsor)[^"']*)["']/i);
        if (sponsorLinkMatch) {
          let sponsorLink = sponsorLinkMatch[1];
          if (!sponsorLink.startsWith('http')) {
            const baseUrl = new URL(event.url);
            sponsorLink = `${baseUrl.protocol}//${baseUrl.host}${sponsorLink}`;
          }
          sponsorStatus = `[Become a Sponsor](${sponsorLink})`;
        }
      }

      // Override with known sponsor URL
      if (event.sponsorUrl) {
        sponsorStatus = `[Become a Sponsor](${event.sponsorUrl})`;
      }

      return {
        ...event,
        status: 'pending',
        cfpStatus,
        ticketStatus,
        sponsorStatus,
        date,
        location
      };
    } catch (error) {
      // Same as the non-200 case: keep any curated override links on a failed fetch,
      // plus a curated override date (e.g. site-verified) instead of wiping to TBD.
      return {
        ...event,
        status: 'pending',
        cfpStatus: event.cfpUrl ? `[OPEN](${event.cfpUrl})` : 'TBD',
        ticketStatus: event.ticketUrl ? `[Buy Tickets](${event.ticketUrl})` : 'TBD',
        sponsorStatus: event.sponsorUrl ? `[Become a Sponsor](${event.sponsorUrl})` : 'TBD',
        date: (event.date && event.date !== 'TBD') ? event.date : 'TBD',
        location: 'TBD'
      };
    }
  }

  try {
    const result = await fetchUrl(event.url);

    if (result.statusCode !== 200) {
      // Even if website is inactive, preserve override values
      let cfpStatus = event.cfpUrl ? `[OPEN](${event.cfpUrl})` : 'TBD';
      let ticketStatus = event.ticketUrl ? `[Buy Tickets](${event.ticketUrl})` : 'TBD';
      let sponsorStatus = event.sponsorUrl ? `[Become a Sponsor](${event.sponsorUrl})` : 'TBD';
      return { ...event, status: 'inactive', statusCode: result.statusCode, cfpStatus, ticketStatus, sponsorStatus };
    }

    const body = result.body.toLowerCase();

    // Check for known CFP URL
    let cfpStatus = 'TBD';
    let cfpLink = null;
    if (event.cfpUrl) {
      cfpStatus = `[OPEN](${event.cfpUrl})`;
      cfpLink = event.cfpUrl;
    } else {
      // Search for CFP keywords
      const cfpKeywords = [
        'call for speakers',
        'call for presenters',
        'submit a session',
        'speaker submission',
        'cfp',
        'call-for-speakers'
      ];

      const hasCFP = cfpKeywords.some(keyword => body.includes(keyword));

      if (hasCFP) {
        // Try to extract CFP link
        const cfpLinkMatch = body.match(/href=["']([^"']*(?:call-for-speakers|speaker|submit|cfp)[^"']*)["']/i);
        if (cfpLinkMatch) {
          let extractedCfpLink = cfpLinkMatch[1];
          if (!extractedCfpLink.startsWith('http')) {
            const baseUrl = new URL(event.url);
            extractedCfpLink = `${baseUrl.protocol}//${baseUrl.host}${extractedCfpLink}`;
          }
          cfpStatus = `[OPEN](${extractedCfpLink})`;
          cfpLink = extractedCfpLink;
        } else {
          cfpStatus = 'TBD';
        }
      }
    }

    // Search for ticket sales keywords
    const ticketKeywords = [
      'tickets',
      'register',
      'buy tickets',
      'ticket sales',
      'purchase',
      'get tickets',
      'registration',
      'register now',
      'sign up',
      'signup'
    ];

    const hasTickets = ticketKeywords.some(keyword => body.includes(keyword));

    let ticketStatus = 'TBD';
    if (hasTickets) {
      // Collect candidate links and skip sponsor/speaker registration links: these
      // also contain "register" but are not ticket sales (e.g. ".../register-sponsor"),
      // which previously got mislabeled as "Buy Tickets".
      const ticketCandidate = [...body.matchAll(/href=["']([^"']*(?:ticket|register|buy)[^"']*)["']/gi)]
        .map(m => m[1])
        .find(link => !/sponsor|speaker/i.test(link));
      if (ticketCandidate) {
        let ticketLink = ticketCandidate;
        if (!ticketLink.startsWith('http')) {
          const baseUrl = new URL(event.url);
          ticketLink = `${baseUrl.protocol}//${baseUrl.host}${ticketLink}`;
        }
        // Check if the link is for the correct year (2026)
        const yearMatch = ticketLink.match(/20([0-9]{2})/);
        if (yearMatch && yearMatch[1] !== '26') {
          ticketStatus = 'TBD';
        } else {
          ticketStatus = `[Buy Tickets](${ticketLink})`;
        }
      } else {
        ticketStatus = 'TBD';
      }
    }

    // Override with known ticket URL
    if (event.ticketUrl) {
      ticketStatus = `[Buy Tickets](${event.ticketUrl})`;
    }

    // Search for sponsor keywords
    const sponsorKeywords = [
      'sponsor',
      'sponsorship',
      'become a sponsor',
      'sponsor us',
      'partnership'
    ];

    const hasSponsor = sponsorKeywords.some(keyword => body.includes(keyword));

    let sponsorStatus = 'TBD';
    if (hasSponsor) {
      // Try to extract sponsor link
      const sponsorLinkMatch = body.match(/href=["']([^"']*(?:sponsor)[^"']*)["']/i);
      if (sponsorLinkMatch) {
        let sponsorLink = sponsorLinkMatch[1];
        if (!sponsorLink.startsWith('http')) {
          const baseUrl = new URL(event.url);
          sponsorLink = `${baseUrl.protocol}//${baseUrl.host}${sponsorLink}`;
        }
        sponsorStatus = `[Become a Sponsor](${sponsorLink})`;
      } else {
        sponsorStatus = 'TBD';
      }
    }

    // Override with known sponsor URL
    if (event.sponsorUrl) {
      sponsorStatus = `[Become a Sponsor](${event.sponsorUrl})`;
    }

    let overallStatus = 'active';
    if (cfpStatus.startsWith('[OPEN]') || cfpLink) {
      overallStatus = 'cfp-open';
    }

    return {
      ...event,
      status: overallStatus,
      cfpStatus,
      cfpLink,
      ticketStatus,
      sponsorStatus
    };
  } catch (error) {
    // Preserve manually configured URLs even when there's an error
    let cfpStatus = 'TBD';
    let ticketStatus = 'TBD';
    let sponsorStatus = 'TBD';

    if (event.cfpUrl) {
      cfpStatus = `[OPEN](${event.cfpUrl})`;
    }

    if (event.ticketUrl) {
      ticketStatus = `[Buy Tickets](${event.ticketUrl})`;
    }

    if (event.sponsorUrl) {
      sponsorStatus = `[Become a Sponsor](${event.sponsorUrl})`;
    }

    return {
      ...event,
      status: 'error',
      error: error.message,
      cfpStatus,
      ticketStatus,
      sponsorStatus
    };
  }
}

// Per-event .ics downloads — links point at GitHub's blob view, whose
// "Download raw file" button performs a reliable download. raw.githubusercontent
// serves .ics as text/plain, so a raw click only displays the file as text.
const ICS_BASE = 'https://github.com/joncline/salesforce-community-events/blob/main/ics';

function slugifyEventName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')                    // fold accents (dreamOlé -> dreamole)
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')         // apostrophes, spaces, symbols -> dash
    .replace(/^-+|-+$/g, '');
}

// event.date -> { dtstart, dtend } as YYYYMMDD. DTEND is EXCLUSIVE (RFC 5545
// VALUE=DATE): a single-day event gets start+1. Returns null for unparseable
// formats — those events get no .ics and no Calendar link.
function icsDates(dateStr) {
  const MONTHS = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
                   July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
  const fmt = d => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const toDate = (month, day, year) => new Date(Date.UTC(year, MONTHS[month], day));
  const exclusiveEnd = d => new Date(d.getTime() + 86400000); // +1 day
  const s = dateStr.trim();

  // "June 23 - June 25, 2027" — cross-month range; only the end carries the year
  let m = s.match(/^([A-Za-z]+) (\d{1,2}) - ([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (m) {
    const start = toDate(m[1], +m[2], +m[5]);
    return { dtstart: fmt(start), dtend: fmt(exclusiveEnd(toDate(m[3], +m[4], +m[5]))) };
  }
  // "July 20-22, 2027" — same-month range
  m = s.match(/^([A-Za-z]+) (\d{1,2})-(\d{1,2}), (\d{4})$/);
  if (m) {
    const start = toDate(m[1], +m[2], +m[4]);
    return { dtstart: fmt(start), dtend: fmt(exclusiveEnd(toDate(m[1], +m[3], +m[4]))) };
  }
  // "November 7, 2026" — single day
  m = s.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (m) {
    const start = toDate(m[1], +m[2], +m[3]);
    return { dtstart: fmt(start), dtend: fmt(exclusiveEnd(start)) };
  }
  return null;
}

function escapeIcsText(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Write one .ics per dated event into ics/ (all-day VEVENT, CRLF line endings).
// DTSTAMP is pinned to the event's own start so re-runs produce byte-identical
// files — no git churn on clean runs. Only changed files are rewritten; slugs
// of renamed/rolled-away events are removed.
function generateIcsFiles(results) {
  const icsDir = path.join(__dirname, 'ics');
  if (!fs.existsSync(icsDir)) fs.mkdirSync(icsDir);

  const wanted = new Set();
  let written = 0;
  for (const event of results) {
    const date = event.date || 'TBD';
    if (date === 'TBD') continue;
    const span = icsDates(date);
    if (!span) { console.log(`   ⚠️  Unparseable date for .ics: ${event.name} "${date}"`); continue; }

    const slug = slugifyEventName(event.name);
    const relPath = `ics/${slug}.ics`;
    wanted.add(relPath);
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//salesforce-community-events//calendar//EN',
      'BEGIN:VEVENT',
      `UID:${slug}@salesforce-events`,
      `DTSTAMP:${span.dtstart}T000000Z`,
      `DTSTART;VALUE=DATE:${span.dtstart}`,
      `DTEND;VALUE=DATE:${span.dtend}`,
      `SUMMARY:${escapeIcsText(event.name)}`,
      ...(event.location && event.location !== 'TBD' ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
      ...(event.url && event.url !== 'TBD' ? [`URL:${event.url}`] : []),
      `DESCRIPTION:${escapeIcsText('Salesforce community event. Details and updates: ' + (event.url || 'the events calendar'))}`,
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ].join('\r\n');

    const file = path.join(icsDir, `${slug}.ics`);
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === body) continue;
    fs.writeFileSync(file, body, 'utf8');
    written++;
  }

  let removed = 0;
  for (const f of fs.readdirSync(icsDir)) {
    if (f.endsWith('.ics') && !wanted.has(`ics/${f}`)) { fs.unlinkSync(path.join(icsDir, f)); removed++; }
  }
  console.log(`✅ ICS: ${wanted.size} events offer downloads (${written} written, ${removed} removed)`);
}

// Update README with results
function updateReadme(results) {
  const readmePath = path.join(__dirname, 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf8');

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Render order: dated rows ascending by start date, TBD rows at the bottom
  // (parseEventDate maps TBD to 9999-12-31 and reduces ranges to their start).
  // Dates were often only learned at check time (site scrape or a rolled
  // event's override), so sorting would break on the pre-check EVENTS order —
  // _order survives the dedupe merge and breaks ties / orders the TBD block.
  results.sort((a, b) => {
    const timeDiff = parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (a._order ?? 0) - (b._order ?? 0);
  });

  // Build new table content
  let tableRows = '';
  results.forEach(event => {
    // Ensure all values are properly formatted and not undefined
    const name = event.name || 'TBD';
    const date = event.date || 'TBD';
    const location = event.location || 'TBD';
    const url = event.url || 'TBD';
    const cfpStatus = event.cfpStatus || 'TBD';
    const ticketStatus = event.ticketStatus || 'TBD';
    const sponsorStatus = event.sponsorStatus || 'TBD';

    // Dated rows link the generated per-event .ics; TBD rows have none yet.
    const span = date !== 'TBD' ? icsDates(date) : null;
    const calendarCell = span ? `[Add 📅](${ICS_BASE}/${slugifyEventName(name)}.ics)` : 'TBD';

    tableRows += `| ${name} | ${date} | ${calendarCell} | ${location} | [Website](${url}) | ${cfpStatus} | ${ticketStatus} | ${sponsorStatus} |\n`;
  });

  // Replace the table rows in README
  const tableRegex = /### Events Overview Table[\s\S]*?### Tentative Events/;

  const newTable = `### Events Overview Table

| Event | Date | Calendar | Location | Website | CFP Status | Ticket Sales | Sponsor |
|-------|------|----------|----------|---------|------------|--------------|---------|
${tableRows}
### Tentative Events`;

  readme = readme.replace(tableRegex, newTable);

  fs.writeFileSync(readmePath, readme, 'utf8');
  console.log('✅ README.md Events Overview Table updated successfully!');
}

// Fetch and compare events from cross-reference URLs to spot missing events
async function checkCrossReference() {
  const knownNames = EVENTS.map(e => normalizeEventName(e.name).toLowerCase());
  const found = [];

  for (const refUrl of CROSS_REFERENCE_URLS) {
    console.log(`\n🔗 Cross-referencing: ${refUrl}`);
    try {
      // r.jina.ai renders JS + returns markdown — it needs a longer timeout.
      const result = await fetchUrl(refUrl, refUrl.includes('r.jina.ai') ? 60000 : 15000);
      if (result.statusCode !== 200) {
        console.log(`   ⚠️  Could not fetch cross-reference page (status ${result.statusCode})`);
        continue;
      }

      // Extract all hyperlinked text that looks like event names (contains "dreamin" or known keywords)
      const body = result.body;
      const linkPattern = /<a[^>]*href=["']([^"']*)["'][^>]*>([^<]+)<\/a>/gi;
      // r.jina.ai output is markdown — parse [text](url) too. (?<!!) skips image ![alt](src).
      const mdLinkPattern = /(?<!!)\[([^\[\]]{6,80})\]\([^)]{0,200}\)/g;
      const eventKeywords = /dreamin|cactus|salesforce|forcelandia|ohana|witness|trailblazer|dreaming/i;

      let match;
      const candidates = new Set();
      while ((match = linkPattern.exec(body)) !== null) {
        const linkText = match[2].trim();
        if (eventKeywords.test(linkText) && linkText.length > 5 && linkText.length < 80) {
          candidates.add(linkText);
        }
      }
      while ((match = mdLinkPattern.exec(body)) !== null) {
        const linkText = match[1].trim();
        if (eventKeywords.test(linkText) && linkText.length > 5 && linkText.length < 80) {
          candidates.add(linkText);
        }
      }

      // Check candidates against known events
      for (const candidate of candidates) {
        const normalized = normalizeEventName(candidate).toLowerCase();
        const isKnown = knownNames.some(name => normalized.includes(name.split(' ')[0].toLowerCase()) && normalized.length < name.length + 15);
        if (!isKnown && /202[6-9]|2027/.test(candidate)) {
          found.push({ name: candidate, source: refUrl });
        }
      }
    } catch (err) {
      console.log(`   ⚠️  Error fetching cross-reference: ${err.message}`);
    }
  }

  if (found.length > 0) {
    console.log('\n🆕 Potential new events found in cross-reference sources (not in current list):');
    found.forEach(e => console.log(`   - ${e.name} (from ${e.source})`));
  } else {
    console.log('   ✅ No new events detected in cross-reference sources.');
  }
}

// Manual events not in the Salesforce API but should be included
const MANUAL_EVENTS = [
  {
    name: "Education Trailblazers Summit 2026",
    date: "June 24-25, 2026",
    location: "Denver, Colorado, USA",
    url: "https://summit.educationtrailblazersassociation.org"
  },
  {
    name: "Dreamin' in Color 2026",
    date: "August 13-15, 2026",
    location: "Atlanta, Georgia, USA",
    url: "https://dreaminincolor.com/",
    ticketUrl: "https://events.humanitix.com/dreamin-in-color-2026/tickets",
    sponsorUrl: "https://dreaminincolor.myshopify.com/"
  },
  {
    // The Salesforce API feed is inconsistent about Forcelandia; pin it here so it
    // doesn't vanish from the table on runs where the API omits it.
    name: "Forcelandia 2026",
    date: "July 29-30, 2026",
    location: "Portland, United States",
    url: "https://forcelandia.com/",
    ticketUrl: "https://www.eventbrite.com/e/forcelandia-2026-tickets-1988583489749",
    sponsorUrl: "https://forcelandia.com/2026-sponsors/"
  },
  {
    name: "Test Dreamin' 2026",
    date: "TBD",
    location: "TBD",
    url: "https://www.testdreamin.com/"
  },
  {
    name: "Life Sciences Dreamin' 2026",
    date: "TBD",
    location: "TBD",
    url: "https://lifesciencesdreamin.com/"
  },
  {
    name: "Salesforce EOY Benelux 2026",
    date: "December 10, 2026",
    location: "Kontich, Belgium",
    url: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7464689853214044160/"
  },
  {
    name: "Higher Ed Dreamin' 2026",
    date: "TBD",
    location: "Virtual",
    url: "https://highereddreamin.com/"
  },
  {
    // Sercante's marketing-focused community event ("Mar" = Marketing Cloud Account
    // Engagement, the rebrand of ParDreamin'). No 2026 date announced; last edition was
    // the 2025 Summit (Atlanta, GA, May 7-8). Listed TBD as it hasn't run in over a year.
    name: "MarDreamin' 2026",
    date: "TBD",
    location: "TBD",
    url: "https://mardreamin.com/",
    ticketUrl: "https://mardreamin.com/summit-registration/",
    sponsorUrl: "https://mardreamin.com/become-a-sponsor/"
  },
  {
    // ParDreamin' — the original Pardot-focused Sercante event, predecessor to MarDreamin'.
    // Site is stale (latest content is the Oct 2022 virtual conference). Listed TBD.
    name: "ParDreamin' 2026",
    date: "TBD",
    location: "TBD",
    url: "https://pardreamin.com/",
    // Set explicitly: the page's relative href ("become-a-sponsor/") otherwise gets
    // joined without a slash into a broken "pardreamin.combecome-a-sponsor/" link.
    sponsorUrl: "https://pardreamin.com/become-a-sponsor/"
  },
  {
    // The Salesforce API feed carries no DevOps Dreamin' record; date announced 2026-11-04.
    name: "DevOps Dreamin' 2027",
    date: "January 28, 2027",
    location: "London, UK",
    url: "https://devopsdreamin.com/"
  }
];

// Main execution
async function main() {
  console.log('🔍 Fetching events from Salesforce API...');
  const apiEvents = await fetchEventsFromAPI();

  // Merge API events with manual events, then categorize/sort the combined list so
  // manual events interleave with API events by date instead of being appended.
  EVENTS = dedupeEvents(categorizeAndSortEvents([...apiEvents, ...MANUAL_EVENTS]));
  
  console.log(`📅 Found ${EVENTS.length} events for 2026-2027 (including ${MANUAL_EVENTS.length} manual events).`);
  console.log('🔍 Checking Call for Presenters and Ticket Sales status for all events...\n');

  const results = [];

  for (let i = 0; i < EVENTS.length; i++) {
    const event = EVENTS[i];
    process.stdout.write(`Checking ${event.name}... `);
    const result = await checkEvent(event);
    result._order = i;  // stable render order, immune to override renames
    results.push(result);
    
    const statusEmoji = {
      'cfp-open': '✅',
      'cfp-mentioned': '📝',
      'active': '🌐',
      'inactive': '❌',
      'error': '⚠️',
      'pending': '⏳',
      'past': '📅'
    };
    
    console.log(`${statusEmoji[result.status] || '❓'} ${result.status}`);
    console.log(`   CFP: ${result.cfpStatus} | Ticket: ${result.ticketStatus} | Sponsor: ${result.sponsorStatus}`);
    
    // Be nice to servers - wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Collapse same-name rows that only differ after check-time override renames
  // (e.g. a rolled 2026 placeholder renamed into the API's native 2027 event).
  // dedupeEvents keeps the higher-scored copy and preserves insertion order,
  // so the summary counts and table row count stay coherent.
  const dedupedResults = dedupeEvents(results);

  console.log('\n📊 Summary:');
  console.log(`   CFP Open: ${dedupedResults.filter(r => r.status === 'cfp-open').length}`);
  console.log(`   Active Sites: ${dedupedResults.filter(r => r.status === 'active' || r.status === 'cfp-mentioned').length}`);
  console.log(`   Inactive: ${dedupedResults.filter(r => r.status === 'inactive' || r.status === 'error').length}`);

  console.log('\n📝 Updating README.md...');
  updateReadme(dedupedResults);
  generateIcsFiles(dedupedResults);
  
  console.log('\n🔍 Running cross-reference check for new events...');
  await checkCrossReference();

  console.log('\n✨ Done!');
}

main().catch(console.error);

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
    const year = new Date(event.start_date).getFullYear();
    return year === 2026 || year === 2027;
  }).map(event => {
    // Format date
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    const startMonth = startDate.toLocaleString('en-US', { month: 'long' });
    const endMonth = endDate.toLocaleString('en-US', { month: 'long' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = startDate.getFullYear();

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

  // Override specific events with known URLs and fix names
  const overrides = {
    "Architect Dreamin' US": {
      ticketUrl: "https://e.runevents.net/architect-dreamin-2026/checkout",
      sponsorUrl: "https://architectdreamin.us/sponsors"
    },
    "Cactusforce": {
      ticketUrl: "https://cactusforce.com/register",
      sponsorUrl: "https://cactusforce.com/sponsor"
    },
    "Irish Dreamin'": {
      cfpUrl: "https://irishdreamin.ie/call-for-speakers/",
      ticketUrl: "https://irishdreamin.ie/book-tickets/",
      sponsorUrl: "https://irishdreamin.ie/sponsor-interest/"
    },
    "Yeur Architect Dreamin 2026": {
      name: "Architect Dreamin' Europe",
      location: "Helsinki, Finland"
    }
    // Add more overrides as needed
  };

  // Apply overrides and prepare events
  const eventsWithOverrides = filteredEvents.map(event => {
    const override = overrides[event.name];
    if (override) {
      return { ...event, ...override };
    }
    return event;
  });

  // Separate events by status: future, past, and unknown
  const futureEvents = [];
  const pastEvents = [];
  const unknownEvents = [];

  const now = new Date();

  eventsWithOverrides.forEach(event => {
    // Check if URL is accessible (basic check - not empty and doesn't contain obvious placeholders)
    const hasValidUrl = event.url && event.url !== 'TBD' && !event.url.includes('example.com') && !event.url.includes('placeholder');

    if (!hasValidUrl) {
      // Set URL to TBD for unknown events
      unknownEvents.push({ ...event, url: 'TBD', isPast: false });
    } else {
      // Parse the event date to determine if it's past or future
      // Handle date ranges like "July 8-9, 2026" or single dates like "January 22, 2026"
      let endDateStr = event.date;

      // If it's a range, get the end date
      if (event.date.includes(' - ')) {
        const parts = event.date.split(' - ');
        if (parts.length === 2) {
          // For ranges like "July 8 - August 9, 2026", take the second part
          endDateStr = parts[1];
        }
      } else if (event.date.includes('-')) {
        // For same-month ranges like "July 8-9, 2026", extract the end day
        const match = event.date.match(/(\w+ \d+)-(\d+), (\d+)/);
        if (match) {
          endDateStr = `${match[1].split(' ')[0]} ${match[2]}, ${match[3]}`;
        }
      }

      // Create a Date object from the parsed date string
      const endDate = new Date(endDateStr + ' UTC'); // Add UTC to ensure consistent parsing
      const isPast = endDate < now;

      if (isPast) {
        pastEvents.push({ ...event, isPast: true });
      } else {
        futureEvents.push({ ...event, isPast: false });
      }
    }
  });

  // Return future events first, then past events, then unknown events
  return [...futureEvents, ...pastEvents, ...unknownEvents];
}

// Check if website is active and look for CFP and ticket sales links
async function checkEvent(event) {
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

  // Handle past events - only check for future year mentions
  if (event.isPast) {
    try {
      const result = await fetchUrl(event.url);

      if (result.statusCode !== 200) {
        return {
          ...event,
          status: 'past',
          cfpStatus: 'TBD',
          ticketStatus: 'TBD',
          sponsorStatus: 'TBD'
        };
      }

      const body = result.body.toLowerCase();

      // For past events, only look for future year mentions (2027)
      const hasFutureCFP = /202[7-9]/.test(body) && (
        body.includes('call for speakers') ||
        body.includes('call for presenters') ||
        body.includes('submit a session') ||
        body.includes('speaker submission') ||
        body.includes('cfp')
      );

      const hasFutureTickets = /202[7-9]/.test(body) && (
        body.includes('tickets') ||
        body.includes('register') ||
        body.includes('buy tickets')
      );

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
        status: 'past',
        cfpStatus: hasFutureCFP ? 'TBD' : 'TBD', // Always TBD for past events unless specifically checking future
        ticketStatus: hasFutureTickets ? 'TBD' : 'TBD', // Always TBD for past events
        sponsorStatus
      };
    } catch (error) {
      return {
        ...event,
        status: 'past',
        cfpStatus: 'TBD',
        ticketStatus: 'TBD',
        sponsorStatus: 'TBD'
      };
    }
  }

  try {
    const result = await fetchUrl(event.url);

    if (result.statusCode !== 200) {
      return { ...event, status: 'inactive', statusCode: result.statusCode };
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
      // Try to extract ticket link
      const ticketLinkMatch = body.match(/href=["']([^"']*(?:ticket|register|buy)[^"']*)["']/i);
      if (ticketLinkMatch) {
        let ticketLink = ticketLinkMatch[1];
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

// Update README with results
function updateReadme(results) {
  const readmePath = path.join(__dirname, 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf8');

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Sort results to match the order in EVENTS
  results.sort((a, b) => {
    const indexA = EVENTS.findIndex(e => e.name === a.name);
    const indexB = EVENTS.findIndex(e => e.name === b.name);
    return indexA - indexB;
  });

  // Build new table content
  let tableRows = '';
  results.forEach(event => {
    tableRows += `| ${event.name} | ${event.date} | ${event.location} | [Website](${event.url}) | ${event.cfpStatus} | ${event.ticketStatus} | ${event.sponsorStatus} |\n`;
  });

  // Replace the table rows in README
  const tableRegex = /### Events Overview Table[\s\S]*?### Tentative Events/;

  const newTable = `### Events Overview Table

| Event | Date | Location | Website | CFP Status | Ticket Sales | Sponsor |
|-------|------|----------|---------|------------|--------------|---------|
${tableRows}
### Tentative Events`;

  readme = readme.replace(tableRegex, newTable);

  fs.writeFileSync(readmePath, readme, 'utf8');
  console.log('✅ README.md Events Overview Table updated successfully!');
}

// Main execution
async function main() {
  console.log('🔍 Fetching events from Salesforce API...');
  EVENTS = await fetchEventsFromAPI();
  console.log(`📅 Found ${EVENTS.length} events for 2026-2027.`);
  console.log('🔍 Checking Call for Presenters and Ticket Sales status for all events...\n');

  const results = [];
  
  for (const event of EVENTS) {
    process.stdout.write(`Checking ${event.name}... `);
    const result = await checkEvent(event);
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
  
  console.log('\n📊 Summary:');
  console.log(`   CFP Open: ${results.filter(r => r.status === 'cfp-open').length}`);
  console.log(`   Active Sites: ${results.filter(r => r.status === 'active' || r.status === 'cfp-mentioned').length}`);
  console.log(`   Inactive: ${results.filter(r => r.status === 'inactive' || r.status === 'error').length}`);
  
  console.log('\n📝 Updating README.md...');
  updateReadme(results);
  
  console.log('\n✨ Done!');
}

main().catch(console.error);

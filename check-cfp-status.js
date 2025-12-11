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

// Event configuration - Updated with all 35 events
const EVENTS = [
  {
    name: "Architect Dreamin' US",
    date: "January 21-22, 2026",
    location: "Scottsdale, AZ",
    url: "https://architectdreamin.com",
    ticketUrl: "https://e.runevents.net/architect-dreamin-2026/checkout",
    sponsorUrl: "https://architectdreamin.us/sponsors"
  },
  {
    name: "Cactusforce",
    date: "January 22-23, 2026",
    location: "Scottsdale, AZ",
    url: "https://cactusforce.com",
    ticketUrl: "https://cactusforce.com/register",
    sponsorUrl: "https://cactusforce.com/sponsor"
  },
  {
    name: "Philippines Dreamin'",
    date: "January 22-23, 2026",
    location: "Mandaluyong City, Philippines",
    url: "https://phdreamin.com"
  },
  {
    name: "Japan Dreamin'",
    date: "January 23, 2026",
    location: "Tokyo, Japan",
    url: "https://www.japandreamin.com"
  },
  {
    name: "Bharat Dreamin'",
    date: "January 24, 2026",
    location: "Jaipur, India",
    url: "https://bharatdreamin.com",
    sponsorUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeyry64v1swzQbeeUl8WVS370ALI3LY8mRtr3OKioj0qk9GtA/viewform"
  },
  {
    name: "Cairo Dreamin'",
    date: "January 31, 2026",
    location: "Cairo, Egypt",
    url: "https://cairodreamin.com",
    cfpUrl: "https://www.cairodreamin.com/speakers/",
    sponsorUrl: "https://www.cairodreamin.com/sponsors/"
  },
  {
    name: "Irish Dreamin'",
    date: "March 19, 2026",
    location: "Dublin, Ireland",
    url: "https://irishdreamin.ie",
    cfpUrl: "https://irishdreamin.ie/call-for-speakers/",
    ticketUrl: "https://irishdreamin.ie/book-tickets/",
    sponsorUrl: "https://irishdreamin.ie/sponsor-interest/"
  },
  {
    name: "Polish Dreamin'",
    date: "March 20, 2026",
    location: "Wrocław, Poland",
    url: "https://dreamin.coffeeforce.pl",
    cfpUrl: "https://dreamin.coffeeforce.pl#speakers",
    ticketUrl: "https://dreamin.coffeeforce.pl#tickets"
  },
  {
    name: "Nonprofit Dreamin'",
    date: "March 25-27, 2026",
    location: "Charlotte, NC",
    url: "https://www.nonprofitdreamin.org"
  },
  {
    name: "dreamOlé",
    date: "March 27, 2026",
    location: "Valencia, Spain",
    url: "https://dreamole.es"
  },
  {
    name: "TrailblazerDX 2026",
    date: "April 15-16, 2026",
    location: "San Francisco, CA",
    url: "https://www.salesforce.com/trailblazerdx",
    cfpUrl: "https://reg.salesforce.com/flow/plus/tdx26/sessionproposal/cfphome",
    ticketUrl: "https://www.salesforce.com/dreamforce/register/"
  },
  {
    name: "Albania Dreamin'",
    date: "April 25, 2026",
    location: "Tirana, Albania",
    url: "https://dreamin.al",
    sponsorUrl: "https://dreamin.al/wp-content/uploads/2024/12/ad2025-sponsorship-prospectus.pdf"
  },
  {
    name: "Mid Atlantic Dreamin'",
    date: "May 4, 2026",
    location: "Philadelphia, PA",
    url: "https://midatlanticdreamin.com",
    sponsorUrl: "https://midatlanticdreamin.com/2024-sponsors.html"
  },
  {
    name: "Wir sind Ohana",
    date: "May 8, 2026",
    location: "Berlin, Germany",
    url: "https://wirsindohana.wordpress.com"
  },
  {
    name: "True North Dreamin'",
    date: "May 11-12, 2026",
    location: "Toronto, Canada",
    url: "https://truenorthdreamin.com",
    cfpUrl: "https://truenorthdreamin.com/call-for-speakers",
    ticketUrl: "https://truenorthdreamin.com/tnd26-tickets",
    sponsorUrl: "https://truenorthdreamin.com/sponsors-2026"
  },
  {
    name: "Dreamin' in Data",
    date: "May 19-20, 2026",
    location: "Chicago, IL",
    url: "https://www.dreaminindata.org"
  },
  {
    name: "CzechDreamin",
    date: "May 29, 2026",
    location: "Prague, Czech Republic",
    url: "https://czechdreamin.com",
    ticketUrl: "https://www.eventbrite.com/e/czechdreamin-2026-tickets-1430906181909?aff=oddtdtcreator",
    sponsorUrl: "https://czechdreamin.com/call-for-sponsors/"
  },
  {
    name: "London's Calling",
    date: "June 5, 2026",
    location: "London, UK",
    url: "https://londonscalling.net",
    cfpUrl: "https://www.londonscalling.net/cfp/",
    ticketUrl: "https://www.eventbrite.com/e/londons-calling-2026-the-largest-european-salesforce-community-event-tickets-1857045215229",
    sponsorUrl: "https://www.londonscalling.net/sponsor-interest/"
  },
  {
    name: "Portugal Dreamin'",
    date: "June 19, 2026",
    location: "Lisbon, Portugal",
    url: "https://www.portugaldreamin.com/en",
    ticketUrl: "https://www.portugaldreamin.com/en/register",
    sponsorUrl: "https://www.portugaldreamin.com/en/sponsors"
  },
  {
    name: "Texas Dreamin'",
    date: "July 9-10, 2026",
    location: "Austin, TX",
    url: "https://www.texasdreamin.org",
    sponsorUrl: "https://www.texasdreamin.org/sponsorship"
  },
  {
    name: "WITness Success",
    date: "July 22-24, 2026",
    location: "Indianapolis, IN",
    url: "https://witnesssuccess.com",
    sponsorUrl: "https://witnesssuccess.com/sponsors/"
  },
  {
    name: "Buckeye Dreamin'",
    date: "July 28-30, 2026",
    location: "Columbus, OH",
    url: "https://buckeyedreamin.com",
    sponsorUrl: "https://www.buckeyedreamin.com/sponsorship"
  },
  {
    name: "Forcelandia",
    date: "July 29-30, 2026",
    location: "Portland, OR",
    url: "https://forcelandia.com",
    sponsorUrl: "https://forcelandia.com/2026-sponsors/"
  },
  {
    name: "SoCal Dreamin'",
    date: "August 20, 2026",
    location: "Newport Beach, CA",
    url: "https://www.roadmapsolutions.org/socal-dreamin"
  },
  {
    name: "Mile High Dreamin'",
    date: "August 26-27, 2026",
    location: "Denver, CO",
    url: "https://milehighdreamin.com",
    sponsorUrl: "https://www.milehighdreamin.com/sponsors"
  },
  {
    name: "Dreamforce 2026",
    date: "September 15-17, 2026",
    location: "San Francisco, CA",
    url: "https://www.salesforce.com/dreamforce"
  },
  {
    name: "Northeast Dreamin'",
    date: "October 29-30, 2026",
    location: "Concord, NH",
    url: "https://northeastdreamin.com"
  },
  {
    name: "Dubai Dreamin'",
    date: "November 14, 2026",
    location: "Dubai, UAE",
    url: "https://www.dubaidreamin.com"
  },
  {
    name: "French Touch Dreamin'",
    date: "December 2, 2026",
    location: "Paris, France",
    url: "https://frenchtouchdreamin.com",
    sponsorUrl: "https://frenchtouchdreamin.com/index.php/sponsors/"
  },
  {
    name: "Biggest Little Dreamin' 2027",
    date: "January 28-29, 2027",
    location: "Reno, NV",
    url: "https://biggestlittledreamin.com"
  }
];

// Fetch URL content
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SFEventChecker/1.0)'
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

// Check if website is active and look for CFP and ticket sales links
async function checkEvent(event) {
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
    return { ...event, status: 'error', error: error.message, cfpStatus: 'TBD', ticketStatus: 'TBD' };
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
      'error': '⚠️'
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

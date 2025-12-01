#!/usr/bin/env node

/**
 * Salesforce Community Events - Call for Presenters Status Checker
 * 
 * This script checks the status of Call for Presenters/Speakers for all
 * Salesforce community events and updates the README.md file.
 * 
 * Run: node check-cfp-status.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Event configuration
const EVENTS = [
  {
    name: "Architect Dreamin' US",
    date: "January 21-22, 2026",
    location: "Scottsdale, AZ",
    url: "https://architectdreamin.com"
  },
  {
    name: "Cactusforce",
    date: "January 22-23, 2026",
    location: "Scottsdale, AZ",
    url: "https://cactusforce.com"
  },
  {
    name: "Bharat Dreamin'",
    date: "January 24, 2026",
    location: "Jaipur, India",
    url: "https://bharatdreamin.com"
  },
  {
    name: "Cairo Dreamin'",
    date: "January 31, 2026",
    location: "Cairo, Egypt",
    url: "https://cairodreamin.com",
    cfpKeywords: ["call for speakers", "submit", "speaker"]
  },
  {
    name: "Irish Dreamin'",
    date: "March 19, 2026",
    location: "Dublin, Ireland",
    url: "https://irishdreamin.ie"
  },
  {
    name: "Polish Dreamin'",
    date: "March 20, 2026",
    location: "Wrocław, Poland",
    url: "https://dreamin.coffeeforce.pl"
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
    url: "https://www.salesforce.com/trailblazerdx"
  },
  {
    name: "Albania Dreamin'",
    date: "April 25, 2026",
    location: "Tirana, Albania",
    url: "https://dreamin.al"
  },
  {
    name: "Mid Atlantic Dreamin'",
    date: "May 4, 2026",
    location: "Baltimore, MD",
    url: "https://midatlanticdreamin.com"
  },
  {
    name: "True North Dreamin'",
    date: "May 11-12, 2026",
    location: "Toronto, Canada",
    url: "https://truenorthdreamin.com",
    cfpUrl: "https://truenorthdreamin.com/call-for-speakers"
  },
  {
    name: "CzechDreamin",
    date: "May 29, 2026",
    location: "Prague, Czech Republic",
    url: "https://czechdreamin.com"
  },
  {
    name: "London's Calling",
    date: "June 5, 2026",
    location: "London, UK",
    url: "https://londonscalling.net"
  },
  {
    name: "Portugal Dreamin'",
    date: "June 19, 2026",
    location: "Lisbon, Portugal",
    url: "https://www.portugaldreamin.com/en"
  },
  {
    name: "WITness Success",
    date: "July 22-24, 2026",
    location: "Indianapolis, IN",
    url: "https://witnesssuccess.com"
  },
  {
    name: "Buckeye Dreamin'",
    date: "July 28-30, 2026",
    location: "Columbus, OH",
    url: "https://buckeyedreamin.com"
  },
  {
    name: "Forcelandia",
    date: "July 29-30, 2026",
    location: "Portland, OR",
    url: "https://forcelandia.com"
  },
  {
    name: "Mile High Dreamin'",
    date: "August 26-27, 2026",
    location: "Denver, CO",
    url: "https://milehighdreamin.com"
  },
  {
    name: "Dreamforce 2026",
    date: "September 15-17, 2026",
    location: "San Francisco, CA",
    url: "https://www.salesforce.com/dreamforce"
  },
  {
    name: "Texas Dreamin'",
    date: "October 10-11, 2026",
    location: "Austin, TX",
    url: "https://texasdreamin.com"
  },
  {
    name: "Dreamin in Data",
    date: "October 17-18, 2026",
    location: "Scottsdale, AZ",
    url: "https://dreamindata.com"
  },
  {
    name: "French Touch Dreamin'",
    date: "December 2, 2026",
    location: "Paris, France",
    url: "https://frenchtouchdreamin.com"
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

// Check if website is active and look for CFP links
async function checkEvent(event) {
  try {
    const result = await fetchUrl(event.url);
    
    if (result.statusCode !== 200) {
      return { ...event, status: 'inactive', statusCode: result.statusCode };
    }
    
    const body = result.body.toLowerCase();
    
    // Check for known CFP URL
    if (event.cfpUrl) {
      return { ...event, status: 'cfp-open', cfpLink: event.cfpUrl };
    }
    
    // Search for CFP keywords
    const cfpKeywords = event.cfpKeywords || [
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
        let cfpLink = cfpLinkMatch[1];
        if (!cfpLink.startsWith('http')) {
          const baseUrl = new URL(event.url);
          cfpLink = `${baseUrl.protocol}//${baseUrl.host}${cfpLink}`;
        }
        return { ...event, status: 'cfp-open', cfpLink };
      }
      return { ...event, status: 'cfp-mentioned' };
    }
    
    return { ...event, status: 'active' };
  } catch (error) {
    return { ...event, status: 'error', error: error.message };
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
  
  // Categorize results
  const cfpOpen = results.filter(r => r.status === 'cfp-open');
  const active = results.filter(r => r.status === 'active' || r.status === 'cfp-mentioned');
  const inactive = results.filter(r => r.status === 'inactive' || r.status === 'error');
  
  // Build new CFP section
  let cfpSection = `## 📢 Call for Presenters/Speakers Status\n\nLast updated: ${today}\n\n`;
  
  if (cfpOpen.length > 0) {
    cfpSection += `### ✅ Call for Speakers OPEN:\n\n`;
    cfpOpen.forEach((event, index) => {
      cfpSection += `${index + 1}. **${event.name}** (${event.date})\n`;
      if (event.cfpLink) {
        cfpSection += `   - 🔗 [Submit Your Session](${event.cfpLink})\n`;
      }
      cfpSection += `\n`;
    });
  }
  
  if (active.length > 0) {
    cfpSection += `### 🔜 Coming Soon (Websites Active, No CFP Yet):\n\n`;
    active.forEach(event => {
      cfpSection += `- **${event.name}** (${event.date}) - [Website](${event.url})\n`;
    });
    cfpSection += `\n`;
  }
  
  if (inactive.length > 0) {
    cfpSection += `### ⚠️ No Active Website Yet:\n\n`;
    inactive.forEach(event => {
      cfpSection += `- **${event.name}** (${event.date})\n`;
    });
    cfpSection += `\n`;
  }
  
  cfpSection += `> **Note:** This information is automatically updated weekly. Check back regularly for the latest CFP opportunities!\n`;
  
  // Replace the CFP section in README
  const cfpRegex = /## 📢 Call for Presenters\/Speakers Status[\s\S]*?(?=## 📧 Request New Events)/;

  if (cfpRegex.test(readme)) {
    readme = readme.replace(cfpRegex, cfpSection + '\n');
  } else {
    // If section doesn't exist, add it before "Request New Events"
    readme = readme.replace(
      /## 📧 Request New Events/,
      cfpSection + '\n## 📧 Request New Events'
    );
  }
  
  fs.writeFileSync(readmePath, readme, 'utf8');
  console.log('✅ README.md updated successfully!');
}

// Main execution
async function main() {
  console.log('🔍 Checking Call for Presenters status for all events...\n');
  
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

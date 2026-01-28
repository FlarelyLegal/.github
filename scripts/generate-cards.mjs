#!/usr/bin/env node

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Gruvbox color palette
const COLORS = {
  bg: '#282828',
  bg1: '#3c3836',
  bg2: '#504945',
  fg: '#ebdbb2',
  fg2: '#d5c4a1',
  red: '#fb4934',
  green: '#b8bb26',
  yellow: '#fabd2f',
  blue: '#83a598',
  purple: '#d3869b',
  aqua: '#8ec07c',
  orange: '#fe8019',
  gray: '#928374',
};

// Language colors (matching GitHub's)
const LANG_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Rust: '#dea584',
  Shell: '#89e051',
  PHP: '#4F5D95',
  CSS: '#563d7c',
  HTML: '#e34c26',
  MDX: '#fcb32c',
  PLpgSQL: '#336790',
  Go: '#00ADD8',
  Ruby: '#701516',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
};

const ORG = process.env.ORG_NAME || 'flarelylegal';
const OUTPUT_DIR = process.env.OUTPUT_DIR || './profile-summary-card-output/gruvbox';

// Fetch org data using gh CLI
function fetchOrgData() {
  console.log(`Fetching data for org: ${ORG}`);
  
  const reposJson = execSync(
    `gh repo list ${ORG} --limit 100 --json name,description,languages,stargazerCount,forkCount,updatedAt`,
    { encoding: 'utf-8' }
  );
  
  const repos = JSON.parse(reposJson);
  return repos;
}

// Calculate language stats
function calcLanguageStats(repos) {
  const langBytes = {};
  
  for (const repo of repos) {
    if (repo.languages) {
      for (const lang of repo.languages) {
        const name = lang.node?.name || lang.name;
        const size = lang.size || lang.node?.size || 1;
        langBytes[name] = (langBytes[name] || 0) + size;
      }
    }
  }
  
  const total = Object.values(langBytes).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(langBytes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: ((bytes / total) * 100).toFixed(1),
      color: LANG_COLORS[name] || COLORS.gray,
    }));
  
  return sorted;
}

// Calculate org stats
function calcOrgStats(repos) {
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazerCount || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forkCount || 0), 0);
  
  return {
    totalRepos: repos.length,
    totalStars,
    totalForks,
  };
}

// Generate SVG card
function generateCard(title, content, width = 400, height = 200) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${COLORS.fg}; }
    .label { font: 400 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${COLORS.fg2}; }
    .value { font: 600 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${COLORS.fg}; }
    .small { font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; fill: ${COLORS.gray}; }
  </style>
  <rect width="${width}" height="${height}" rx="8" fill="${COLORS.bg}" stroke="${COLORS.bg2}" stroke-width="1"/>
  <text x="20" y="35" class="title">${title}</text>
  ${content}
</svg>`;
}

// Generate repos per language card
function generateLangCard(langStats) {
  const barWidth = 340;
  const barHeight = 10;
  const startY = 60;
  
  let bars = '';
  let legendItems = '';
  let xOffset = 0;
  
  // Create stacked bar
  for (const lang of langStats) {
    const width = (parseFloat(lang.percent) / 100) * barWidth;
    bars += `<rect x="${20 + xOffset}" y="${startY}" width="${width}" height="${barHeight}" fill="${lang.color}" rx="2"/>`;
    xOffset += width;
  }
  
  // Create legend
  let row = 0;
  let col = 0;
  for (let i = 0; i < langStats.length; i++) {
    const lang = langStats[i];
    const x = 20 + (col * 180);
    const y = startY + 35 + (row * 25);
    
    legendItems += `
      <circle cx="${x + 6}" cy="${y}" r="6" fill="${lang.color}"/>
      <text x="${x + 18}" y="${y + 4}" class="label">${lang.name}</text>
      <text x="${x + 120}" y="${y + 4}" class="small">${lang.percent}%</text>
    `;
    
    col++;
    if (col >= 2) {
      col = 0;
      row++;
    }
  }
  
  return generateCard('Top Languages', bars + legendItems, 400, 180);
}

// Generate org stats card
function generateStatsCard(stats) {
  const items = [
    { label: 'Total Repositories', value: stats.totalRepos, icon: '📦' },
    { label: 'Total Stars', value: stats.totalStars, icon: '⭐' },
    { label: 'Total Forks', value: stats.totalForks, icon: '🍴' },
  ];
  
  let content = '';
  items.forEach((item, i) => {
    const y = 70 + (i * 35);
    content += `
      <text x="20" y="${y}" class="label">${item.icon} ${item.label}</text>
      <text x="350" y="${y}" class="value" text-anchor="end">${item.value}</text>
    `;
  });
  
  return generateCard(`${ORG} Stats`, content, 400, 180);
}

// Generate profile details card (wide)
function generateProfileCard(stats, langStats) {
  const topLangs = langStats.slice(0, 3).map(l => l.name).join(', ');
  
  const content = `
    <text x="20" y="70" class="label">Organization focused on Cloudflare, infrastructure, and automation</text>
    <text x="20" y="105" class="label">📦 ${stats.totalRepos} Repositories</text>
    <text x="200" y="105" class="label">⭐ ${stats.totalStars} Stars</text>
    <text x="340" y="105" class="label">🍴 ${stats.totalForks} Forks</text>
    <text x="20" y="140" class="label">🔤 Top Languages: ${topLangs}</text>
  `;
  
  return generateCard(ORG, content, 480, 170);
}

// Main
async function main() {
  console.log('Generating org profile summary cards...');
  
  // Fetch data
  const repos = fetchOrgData();
  console.log(`Found ${repos.length} repos`);
  
  // Calculate stats
  const langStats = calcLanguageStats(repos);
  const orgStats = calcOrgStats(repos);
  
  console.log('Language stats:', langStats);
  console.log('Org stats:', orgStats);
  
  // Create output directory
  mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Generate cards
  const cards = [
    { name: '0-profile-details.svg', svg: generateProfileCard(orgStats, langStats) },
    { name: '1-repos-per-language.svg', svg: generateLangCard(langStats) },
    { name: '3-stats.svg', svg: generateStatsCard(orgStats) },
  ];
  
  // Write cards
  for (const card of cards) {
    const path = join(OUTPUT_DIR, card.name);
    writeFileSync(path, card.svg);
    console.log(`Generated: ${path}`);
  }
  
  console.log('Done!');
}

main().catch(console.error);

import { useEffect, useRef, useState, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './index.css';

pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const emptyPaperPlaceholder = { id: null, title: 'No paper selected', file: null, fileType: 'none', tag: 'neutral', sourceType: 'journal', authors: '', organization: '', journal: '', year: '', volume: '', issue: '', pages: '', doi: '', url: '', city: '', publisher: '', edition: '', accessDate: '', newspaper: '', newsDate: '', thesisType: 'master', university: '', reportSeries: '' };

const emptyMeta = { tag: 'neutral', projectId: null, sourceType: 'journal', authors: '', organization: '', journal: '', year: '', volume: '', issue: '', pages: '', doi: '', url: '', city: '', publisher: '', edition: '', accessDate: '', newspaper: '', newsDate: '', thesisType: 'master', university: '', reportSeries: '' };

const TAG_CONFIG = {
  neutral:    { label: 'Neutral',    bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
  supporting: { label: 'Supporting', bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
  opposing:   { label: 'Opposing',   bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
};

function nextTag(current) {
  if (current === 'neutral') return 'supporting';
  if (current === 'supporting') return 'opposing';
  return 'neutral';
}

// Known global health & academic organizations by domain
const KNOWN_ORGS = {
  // UN System
  'who.int': 'World Health Organization',
  'unicef.org': 'UNICEF',
  'unfpa.org': 'United Nations Population Fund',
  'undp.org': 'United Nations Development Programme',
  'unaids.org': 'UNAIDS',
  'unhcr.org': 'United Nations High Commissioner for Refugees',
  'wfp.org': 'World Food Programme',
  'un.org': 'United Nations',
  'ilo.org': 'International Labour Organization',
  'iom.int': 'International Organization for Migration',
  'unep.org': 'United Nations Environment Programme',
  'unesco.org': 'UNESCO',
  'fao.org': 'Food and Agriculture Organization',
  'paho.org': 'Pan American Health Organization',
  'afro.who.int': 'WHO Regional Office for Africa',
  'euro.who.int': 'WHO Regional Office for Europe',
  'data.unicef.org': 'UNICEF',
  // Humanitarian
  'msf.org': 'Médecins Sans Frontières',
  'msf.se': 'Läkare Utan Gränser',
  'doctorswithoutborders.org': 'Doctors Without Borders',
  'icrc.org': 'International Committee of the Red Cross',
  'ifrc.org': 'International Federation of Red Cross and Red Crescent Societies',
  'oxfam.org': 'Oxfam International',
  'savethechildren.org': 'Save the Children',
  'savethechildren.net': 'Save the Children',
  'savethechildren.se': 'Rädda Barnen',
  'care.org': 'CARE International',
  'concern.net': 'Concern Worldwide',
  'rescue.org': 'International Rescue Committee',
  'mercycorps.org': 'Mercy Corps',
  'actionaid.org': 'ActionAid',
  'plan-international.org': 'Plan International',
  'worldvision.org': 'World Vision',
  // Finance & Development
  'worldbank.org': 'World Bank',
  'imf.org': 'International Monetary Fund',
  'oecd.org': 'Organisation for Economic Co-operation and Development',
  'gavi.org': 'Gavi the Vaccine Alliance',
  'theglobalfund.org': 'The Global Fund',
  'pepfar.gov': 'PEPFAR',
  'usaid.gov': 'United States Agency for International Development',
  // US Health
  'cdc.gov': 'Centers for Disease Control and Prevention',
  'nih.gov': 'National Institutes of Health',
  'ncbi.nlm.nih.gov': 'National Center for Biotechnology Information',
  'pubmed.ncbi.nlm.nih.gov': 'PubMed',
  'fda.gov': 'US Food and Drug Administration',
  'hhs.gov': 'US Department of Health and Human Services',
  'cms.gov': 'Centers for Medicare and Medicaid Services',
  'healthdata.org': 'Institute for Health Metrics and Evaluation',
  // European Health
  'ecdc.europa.eu': 'European Centre for Disease Prevention and Control',
  'ema.europa.eu': 'European Medicines Agency',
  'eurostat.ec.europa.eu': 'Eurostat',
  'europa.eu': 'European Union',
  // Swedish
  'ki.se': 'Karolinska Institutet',
  'kib.ki.se': 'Karolinska Institutet University Library',
  'socialstyrelsen.se': 'Socialstyrelsen',
  'folkhalsomyndigheten.se': 'Folkhälsomyndigheten',
  'lakemedelsverket.se': 'Läkemedelsverket',
  'sbu.se': 'Statens beredning för medicinsk och social utvärdering',
  'riksdagen.se': 'Riksdagen',
  'government.se': 'Government of Sweden',
  'vardgivarguiden.se': 'Vårdgivarguiden',
  'janusinfo.se': 'Janusinfo',
  '1177.se': '1177 Vårdguiden',
  'regionstockholm.se': 'Region Stockholm',
  'vgregion.se': 'Västra Götalandsregionen',
  // Academic publishers
  'nejm.org': 'New England Journal of Medicine',
  'lancet.com': 'The Lancet',
  'bmj.com': 'The BMJ',
  'nature.com': 'Nature Publishing Group',
  'springer.com': 'Springer',
  'elsevier.com': 'Elsevier',
  'wiley.com': 'Wiley',
  'taylorandfrancis.com': 'Taylor and Francis',
  'jamanetwork.com': 'JAMA Network',
  'academic.oup.com': 'Oxford University Press',
};

function getOrgFromDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    // Check exact match first
    if (KNOWN_ORGS[hostname]) return KNOWN_ORGS[hostname];
    // Check subdomains — e.g. data.unicef.org should match unicef.org
    for (const [domain, org] of Object.entries(KNOWN_ORGS)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) return org;
    }
    // Check if any known domain is contained in hostname
    for (const [domain, org] of Object.entries(KNOWN_ORGS)) {
      if (hostname.includes(domain.split('.')[0])) return org;
    }
    return '';
  } catch { return ''; }
}
function extractDOI(text) {
  const patterns = [/https?:\/\/doi\.org\/(10\.\d{4,}[^\s"<>\]]*)/i, /doi\.org\/(10\.\d{4,}[^\s"<>\]]*)/i, /DOI[:\s]+(10\.\d{4,}[^\s"<>\]]*)/i, /\b(10\.\d{4,}\/[^\s"<>\]]*)/i];
  for (const p of patterns) { const m = text.match(p); if (m) return m[1].replace(/[.,;)\]]+$/, '').trim(); }
  return null;
}

async function fetchFromCrossRef(doi) {
  try {
    const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!r.ok) return null;
    const d = await r.json(); const w = d.message;
    const authors = (w.author || []).map(a => `${a.family || ''} ${(a.given || '').split(' ').map(n => n[0]).join('')}`.trim()).join(', ');
    return { title: (w.title || [])[0] || '', authors, journal: (w['container-title'] || [])[0] || '', year: w.published?.['date-parts']?.[0]?.[0]?.toString() || '', volume: w.volume || '', issue: w.issue || '', pages: w.page || '', doi };
  } catch { return null; }
}
async function fetchFromPubMed(doi) {
  try {
    const s = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}&retmode=json`);
    if (!s.ok) return null;
    const sd = await s.json(); const ids = sd.esearchresult?.idlist;
    if (!ids?.length) return null;
    const dr = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids[0]}&retmode=json`);
    if (!dr.ok) return null;
    const dd = await dr.json(); const a = dd.result?.[ids[0]];
    if (!a) return null;
    return { title: a.title || '', authors: (a.authors || []).map(x => x.name).join(', '), journal: a.source || '', year: a.pubdate?.split(' ')[0] || '', volume: a.volume || '', issue: a.issue || '', pages: a.pages || '', doi };
  } catch { return null; }
}
async function fetchFromOpenAlex(doi) {
  try {
    const r = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doi)}`);
    if (!r.ok) return null;
    const w = await r.json();
    const authors = (w.authorships || []).map(a => a.author?.display_name || '').filter(Boolean).join(', ');
    const b = w.biblio || {};
    return { title: w.title || '', authors, journal: w.primary_location?.source?.display_name || '', year: w.publication_year?.toString() || '', volume: b.volume || '', issue: b.issue || '', pages: b.first_page && b.last_page ? `${b.first_page}-${b.last_page}` : b.first_page || '', doi };
  } catch { return null; }
}
async function fetchFromSciELO(doi) {
  try {
    const r = await fetch(`https://api.scielo.org/v1/article/?doi=${encodeURIComponent(doi)}&format=json`);
    if (!r.ok) return null;
    const d = await r.json(); const a = d.objects?.[0];
    if (!a) return null;
    const authors = (a.authors || []).map(x => `${x.surname || ''} ${(x.given_names || '').split(' ').map(n => n[0]).join('')}`.trim()).join(', ');
    return { title: a.title || '', authors, journal: a.journal_title || '', year: a.publication_year?.toString() || '', volume: a.volume || '', issue: a.issue || '', pages: a.start_page && a.end_page ? `${a.start_page}-${a.end_page}` : '', doi };
  } catch { return null; }
}
// Auto-detect metadata from any webpage URL using microlink.io (free)
async function fetchWebpageMeta(url) {
  try {
    const r = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (d.status !== 'success') return null;
    const data = d.data;
    // Extract year from date if available — but don't use current year as it likely means no real date found
    let year = '';
    if (data.date) {
      const match = data.date.match(/(\d{4})/);
      if (match) {
        const detectedYear = match[1];
        const currentYear = new Date().getFullYear().toString();
        // Only use year if it is not the current year — current year likely means no real pub date found
        if (detectedYear !== currentYear) year = detectedYear;
      }
    }
    // Format access date as today
    const today = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const accessDate = `${today.getFullYear()} ${months[today.getMonth()]} ${today.getDate()}`;
    // Clean up publisher — try known orgs first, then microlink publisher
    let organization = getOrgFromDomain(url);
    if (!organization) {
      const raw = data.publisher || '';
      // Ignore domain-only names like "who.int"
      if (raw && raw.includes(' ')) organization = raw;
    }
    return {
      title: data.title || '',
      organization,
      authors: data.author || '',
      year,
      url,
      accessDate,
    };
  } catch { return null; }
}

async function fetchMetadata(doi, onStatus) {
  onStatus('🔍 Trying CrossRef...'); const cr = await fetchFromCrossRef(doi); if (cr?.title) return { meta: cr, source: 'CrossRef' };
  onStatus('🔍 Trying PubMed...'); const pm = await fetchFromPubMed(doi); if (pm?.title) return { meta: pm, source: 'PubMed' };
  onStatus('🔍 Trying OpenAlex...'); const oa = await fetchFromOpenAlex(doi); if (oa?.title) return { meta: oa, source: 'OpenAlex' };
  onStatus('🔍 Trying SciELO...'); const sc = await fetchFromSciELO(doi); if (sc?.title) return { meta: sc, source: 'SciELO' };
  return null;
}
async function extractTextFromPDF(fileUrl) {
  try {
    const pdf = await pdfjs.getDocument(fileUrl).promise;
    let text = '';
    for (let i = 1; i <= Math.min(3, pdf.numPages); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(x => x.str).join(' ');
    }
    return text;
  } catch { return ''; }
}

function limitAuthorsVancouver(authorsStr) {
  if (!authorsStr) return '';
  const list = authorsStr.split(',').map(a => a.trim()).filter(Boolean);
  if (list.length <= 6) return list.join(', ');
  return list.slice(0, 6).join(', ') + ', et al';
}
function formatAuthorsAPA(authorsStr, orgFallback) {
  if (!authorsStr) return orgFallback || 'Author, A.';
  const list = authorsStr.split(',').map(a => a.trim()).filter(Boolean);
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]}, & ${list[1]}`;
  if (list.length <= 20) return `${list.slice(0, -1).join(', ')}, & ${list[list.length - 1]}`;
  return `${list.slice(0, 19).join(', ')}, ... ${list[list.length - 1]}`;
}

// ─── PubMed search for Gap Finder ──────────────────────────────────────────
async function searchPubMed(query, retmax = 30) {
  try {
    const searchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&retmode=json&sort=relevance`);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    const totalCount = parseInt(searchData.esearchresult?.count || '0', 10);
    if (ids.length === 0) return { papers: [], totalCount: 0, yearCounts: {} };

    const summaryRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json();
    const papers = ids.map(id => {
      const a = summaryData.result?.[id];
      if (!a) return null;
      const yearMatch = (a.pubdate || '').match(/(\d{4})/);
      return {
        pmid: id,
        title: a.title || '',
        authors: (a.authors || []).map(x => x.name).join(', '),
        journal: a.source || '',
        year: yearMatch ? yearMatch[1] : '',
        volume: a.volume || '',
        issue: a.issue || '',
        pages: a.pages || '',
        doi: (a.articleids || []).find(x => x.idtype === 'doi')?.value || '',
      };
    }).filter(Boolean);

    return { papers, totalCount };
  } catch { return null; }
}

// Get publication trend per year for a query (uses PubMed date-range counts)
async function getPublicationTrend(query, startYear, endYear) {
  const counts = {};
  // Query in 3-year batches to keep request count low while still useful
  const promises = [];
  for (let y = startYear; y <= endYear; y++) {
    promises.push(
      fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&datetype=pdat&mindate=${y}&maxdate=${y}&retmax=0&retmode=json`)
        .then(r => r.ok ? r.json() : null)
        .then(d => ({ year: y, count: parseInt(d?.esearchresult?.count || '0', 10) }))
        .catch(() => ({ year: y, count: 0 }))
    );
  }
  const results = await Promise.all(promises);
  for (const r of results) counts[r.year] = r.count;
  return counts;
}


function generateCitations(paper) {
  const t = paper.title || 'Title';
  const y = paper.year || 'n.d.';
  const auth = paper.authors || '';
  const org = paper.organization || '';
  const doiLink = paper.doi ? ` https://doi.org/${paper.doi}` : '';
  const url = paper.url || '';
  const city = paper.city || '';
  const pub = paper.publisher || '';
  const acc = paper.accessDate || '';
  const ed = paper.edition ? ` ${paper.edition} ed.` : '';

  switch (paper.sourceType) {
    case 'journal': {
      const j = paper.journal || 'Journal'; const v = paper.volume || ''; const iss = paper.issue || ''; const pg = paper.pages || '';
      const vanA = limitAuthorsVancouver(auth) || org || 'Author A';
      const volVan = v ? `${v}${iss ? `(${iss})` : ''}:${pg}` : pg;
      const vancouver = `${vanA}. ${t}. ${j}. ${y}${volVan ? `;${volVan}` : ''}.${doiLink}`;
      const apaA = formatAuthorsAPA(auth, org);
      const volAPA = v ? `${v}${iss ? `(${iss})` : ''}` : '';
      const apa = `${apaA} (${y}). ${t}. ${j}${volAPA ? `, ${volAPA}` : ''}${pg ? `, ${pg}` : ''}.${doiLink}`;
      const mla = `${auth || org || 'Author'}. "${t}." ${j}${v ? `, vol. ${v}` : ''}${iss ? `, no. ${iss}` : ''}, ${y}${pg ? `, pp. ${pg}` : ''}.`;
      return { apa, mla, vancouver };
    }
    case 'book': {
      const vanA = limitAuthorsVancouver(auth) || org || 'Author A';
      const apaA = formatAuthorsAPA(auth, org);
      const cityPub = [city, pub].filter(Boolean).join(': ');
      const vancouver = `${vanA}. ${t}.${ed ? ` ${ed}.` : ''} ${cityPub ? `${cityPub};` : ''} ${y}.${doiLink}`;
      const apa = `${apaA} (${y}). ${t}${paper.edition ? ` (${paper.edition} ed.)` : ''}. ${pub || city || 'Publisher'}.${doiLink}`;
      const mla = `${auth || org || 'Author'}. ${t}. ${pub || 'Publisher'}, ${y}.`;
      return { apa, mla, vancouver };
    }
    case 'webpage': {
      const nameV = org || limitAuthorsVancouver(auth) || 'Author';
      const nameA = org || formatAuthorsAPA(auth, org);
      const displayYear = y && y !== 'n.d.' ? y : '[date unknown]';
      const displayYearAPA = y && y !== 'n.d.' ? y : 'n.d.';
      const citedP = acc ? ` [cited ${acc}]` : '';
      const availP = url ? ` Available from: ${url}` : '';
      const cityPubP = [city, org || pub].filter(Boolean).join(': ');
      const vancouver = `${nameV}. ${t} [Internet]. ${cityPubP ? `${cityPubP};` : ''} ${displayYear}${citedP}.${availP}`;
      const apa = `${nameA}. (${displayYearAPA}). ${t}. ${url}`;
      const mla = `${nameA}. "${t}." ${org || pub || 'Website'}, ${displayYearAPA}, ${url}`;
      return { apa, mla, vancouver };
    }
    case 'report': {
      const nameV = limitAuthorsVancouver(auth) || org || 'Author';
      const nameA = formatAuthorsAPA(auth, org);
      const citedP = acc ? ` [cited ${acc}]` : '';
      const availP = url ? ` Available from: ${url}` : '';
      const series = paper.reportSeries ? ` ${paper.reportSeries}.` : '';
      const cityPubP = [city, pub || org].filter(Boolean).join(': ');
      const vancouver = `${nameV}. ${t}${url ? ' [Internet]' : ''}.${series} ${cityPubP ? `${cityPubP};` : ''} ${y}${citedP}.${availP}`;
      const apa = `${nameA}. (${y}). ${t}${paper.reportSeries ? ` (${paper.reportSeries})` : ''}. ${pub || org || 'Publisher'}.${url ? ` ${url}` : ''}`;
      const mla = `${nameA}. "${t}." ${pub || org || 'Publisher'}, ${y}.${url ? ` ${url}` : ''}`;
      return { apa, mla, vancouver };
    }
    case 'thesis': {
      const tLabel = paper.thesisType === 'doctoral' ? 'dissertation' : "master's thesis";
      const tLabelA = paper.thesisType === 'doctoral' ? 'Doctoral dissertation' : "Master's thesis";
      const uni = paper.university || 'University';
      const vanA = limitAuthorsVancouver(auth) || 'Author';
      const apaA = formatAuthorsAPA(auth, '');
      const vancouver = `${vanA}. ${t} [${tLabel}]. ${city ? `${city}: ` : ''}${uni}; ${y}.${url ? ` Available from: ${url}` : ''}`;
      const apa = `${apaA} (${y}). ${t} [${tLabelA}, ${uni}].${url ? ` ${url}` : ''}`;
      const mla = `${auth || 'Author'}. "${t}." ${tLabelA}, ${uni}, ${y}.`;
      return { apa, mla, vancouver };
    }
    case 'newspaper': {
      const vanA = limitAuthorsVancouver(auth) || org || 'Author';
      const apaA = formatAuthorsAPA(auth, org);
      const np = paper.newspaper || 'Newspaper'; const nd = paper.newsDate || y;
      const citedP = acc ? ` [cited ${acc}]` : '';
      const availP = url ? ` Available from: ${url}` : '';
      const vancouver = `${vanA}. ${t}. ${np}${url ? ' [Internet]' : ''}. ${nd}${citedP}.${availP}`;
      const apa = `${apaA} (${nd}). ${t}. ${np}.${url ? ` ${url}` : ''}`;
      const mla = `${auth || org || 'Author'}. "${t}." ${np}, ${nd}.${url ? ` ${url}` : ''}`;
      return { apa, mla, vancouver };
    }
    default: return { apa: t, mla: t, vancouver: t };
  }
}

const SOURCE_TYPES = [
  { value: 'journal', label: '📄 Journal article' },
  { value: 'book', label: '📚 Book' },
  { value: 'webpage', label: '🌐 Web page' },
  { value: 'report', label: '📊 Report' },
  { value: 'thesis', label: '🎓 Thesis' },
  { value: 'newspaper', label: '📰 Newspaper' },
];
const FIELDS = {
  journal: ['authors', 'journal', 'year', 'volume', 'issue', 'pages', 'doi'],
  book: ['authors', 'organization', 'year', 'edition', 'city', 'publisher', 'doi', 'url'],
  webpage: ['organization', 'authors', 'year', 'city', 'url', 'accessDate'],
  report: ['organization', 'authors', 'year', 'city', 'publisher', 'reportSeries', 'url', 'accessDate'],
  thesis: ['authors', 'thesisType', 'university', 'year', 'city', 'url'],
  newspaper: ['authors', 'organization', 'newspaper', 'newsDate', 'year', 'url', 'accessDate'],
};
const FIELD_CONFIG = {
  authors: { label: 'Authors (Surname AB, Surname CD)', placeholder: 'e.g. Smith AB, Jones CD' },
  organization: { label: 'Organization / Institution', placeholder: 'e.g. World Health Organization, UNICEF' },
  journal: { label: 'Journal name (abbreviated)', placeholder: 'e.g. Occup Ther Int' },
  year: { label: 'Year', placeholder: 'e.g. 2023' },
  volume: { label: 'Volume', placeholder: 'e.g. 19' },
  issue: { label: 'Issue', placeholder: 'e.g. 3' },
  pages: { label: 'Pages', placeholder: 'e.g. 127-34' },
  doi: { label: 'DOI', placeholder: 'e.g. 10.1002/oti.1327' },
  url: { label: 'URL', placeholder: 'https://...' },
  city: { label: 'City / Place of publication', placeholder: 'e.g. Geneva, Stockholm' },
  publisher: { label: 'Publisher', placeholder: 'e.g. Elsevier, WHO' },
  edition: { label: 'Edition (if not 1st)', placeholder: 'e.g. 3rd' },
  accessDate: { label: 'Date accessed (cited)', placeholder: 'e.g. 2025 Dec 08' },
  newspaper: { label: 'Newspaper name', placeholder: 'e.g. The Guardian' },
  newsDate: { label: 'Publication date', placeholder: 'e.g. 2024 Mar 15' },
  reportSeries: { label: 'Series / Report number (optional)', placeholder: 'e.g. WHO/RHR/18.19' },
  university: { label: 'University / Institution', placeholder: 'e.g. Karolinska Institutet' },
};

function normalizeTitle(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function findDuplicatePaper(allPapers, candidate) {
  const candDoi = (candidate.doi || '').toLowerCase().trim();
  const candTitle = normalizeTitle(candidate.title);
  return allPapers.find(p => {
    if (candDoi && p.doi && p.doi.toLowerCase().trim() === candDoi) return true;
    if (candTitle && normalizeTitle(p.title) === candTitle && candTitle.length > 8) return true;
    return false;
  });
}

// Phrases that commonly signal an explicit research gap stated by the authors themselves
const GAP_PHRASES = [
  'further research is needed', 'further studies are needed', 'future research should',
  'future studies should', 'more research is needed', 'limited data on', 'limited evidence',
  'no studies have', 'few studies have', 'has not been studied', 'has not been investigated',
  'remains unclear', 'remains unknown', 'remains poorly understood', 'gap in the literature',
  'gap in knowledge', 'knowledge gap', 'paucity of', 'scarcity of', 'warrants further investigation',
  'warrants further study', 'is lacking', 'are lacking', 'not well characterized', 'not well understood',
  'limitations of this study', 'larger studies are needed', 'larger trials are needed',
];

// Search PubMed and fetch actual abstract text (via efetch) so we can scan for gap phrases
async function searchPubMedWithAbstracts(query, retmax = 25) {
  try {
    const searchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&retmode=json&sort=relevance`);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return { papers: [] };

    const summaryRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
    const summaryData = summaryRes.ok ? await summaryRes.json() : null;

    const fetchRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=xml`);
    if (!fetchRes.ok) return null;
    const xmlText = await fetchRes.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    const articles = Array.from(xml.getElementsByTagName('PubmedArticle'));

    const papers = articles.map(article => {
      const pmidEl = article.getElementsByTagName('PMID')[0];
      const pmid = pmidEl ? pmidEl.textContent : null;
      if (!pmid) return null;
      const abstractTexts = Array.from(article.getElementsByTagName('AbstractText')).map(el => el.textContent).join(' ');
      const a = summaryData?.result?.[pmid];
      const yearMatch = (a?.pubdate || '').match(/(\d{4})/);

      const lowerAbstract = abstractTexts.toLowerCase();
      const foundPhrases = GAP_PHRASES.filter(phrase => lowerAbstract.includes(phrase));

      return {
        pmid,
        title: a?.title || '',
        authors: (a?.authors || []).map(x => x.name).join(', '),
        journal: a?.source || '',
        year: yearMatch ? yearMatch[1] : '',
        volume: a?.volume || '',
        issue: a?.issue || '',
        pages: a?.pages || '',
        doi: (a?.articleids || []).find(x => x.idtype === 'doi')?.value || '',
        abstract: abstractTexts,
        gapPhrases: foundPhrases,
      };
    }).filter(Boolean);

    return { papers };
  } catch { return null; }
}

// Convert a PMID to a PMC ID if a free full-text version exists
async function getPmcId(pmid) {
  try {
    const res = await fetch(`https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${pmid}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    const record = data.records?.[0];
    if (record && record.pmcid && !record.status) return record.pmcid;
    return null;
  } catch { return null; }
}

// Fetch full text XML from PMC and extract Discussion/Limitations sections only
// (skips Methods/Results to keep things fast and focused on gap-relevant text)
async function fetchPmcDiscussionText(pmcid) {
  try {
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcid.replace('PMC', '')}&rettype=full&retmode=xml`);
    if (!res.ok) return null;
    const xmlText = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    const sections = Array.from(xml.getElementsByTagName('sec'));
    let relevantText = '';
    for (const sec of sections) {
      const titleEl = sec.getElementsByTagName('title')[0];
      const title = (titleEl?.textContent || '').toLowerCase();
      if (title.includes('discussion') || title.includes('limitation') || title.includes('conclusion') || title.includes('future')) {
        relevantText += ' ' + sec.textContent;
      }
    }
    return relevantText.trim() || null;
  } catch { return null; }
}

function App() {
  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(emptyPaperPlaceholder);
  const [projects, setProjects] = useState([]); // [{ id, name, color }]
  const [activeProjectId, setActiveProjectId] = useState('general'); // 'general' | project.id — each is a fully separate workspace
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(false);
  // Storage for every workspace's data except the one currently active (which lives
  // in the main papers/notes/etc state above for full compatibility with existing code).
  // Shape: { [projectId]: { papers, notes, archivedPapers, importedPmids } }
  const [projectWorkspaces, setProjectWorkspaces] = useState({});
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(null);
  const [notes, setNotes] = useState([]);
  const [pageWidth, setPageWidth] = useState(800);
  const [zoom, setZoom] = useState(1.0);
  const [selectedText, setSelectedText] = useState('');
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupCoords, setPopupCoords] = useState({ top: 0, left: 0 });
  const [webQuoteText, setWebQuoteText] = useState('');
  const [citationPopupVisible, setCitationPopupVisible] = useState(false);
  const [citationPaper, setCitationPaper] = useState(null);
  const [copiedFormat, setCopiedFormat] = useState(null);
  const [referencePopupVisible, setReferencePopupVisible] = useState(false);
  const [referenceStyle, setReferenceStyle] = useState(null);
  const [generatedReferences, setGeneratedReferences] = useState('');
  const [referenceCopied, setReferenceCopied] = useState(false);
  const [metadataFormVisible, setMetadataFormVisible] = useState(false);
  const [metadataForm, setMetadataForm] = useState({ title: '', ...emptyMeta });
  const [pendingPaper, setPendingPaper] = useState(null);
  const [editingPaper, setEditingPaper] = useState(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  const [isNewWebSource, setIsNewWebSource] = useState(false);
  const [urlDetecting, setUrlDetecting] = useState(false);

  // Gap Finder / PubMed search state
  const [activeView, setActiveView] = useState('library'); // 'library' | 'gapfinder'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [trendData, setTrendData] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [gapStatementsResults, setGapStatementsResults] = useState(null);
  const [searchingGapStatements, setSearchingGapStatements] = useState(false);
  const [importedPmids, setImportedPmids] = useState([]);
  const [archivedPapers, setArchivedPapers] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { paper, noteCount }
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { existingPaper }
  const [mismatchWarning, setMismatchWarning] = useState(null); // { detectedTitle, detectedDoi, savedTitle, savedDoi }
  const attachPdfInputRef = useRef(null);

  const fileInputRef = useRef(null);
  const viewerRef = useRef(null);
  const citationPopupRef = useRef(null);
  const referencePopupRef = useRef(null);

  const pdfFile = useMemo(() => selectedPaper.file, [selectedPaper.id, selectedPaper.file]);
  const isWebSource = selectedPaper.fileType === 'web';
  const isEmpty = selectedPaper.id === null;

  useEffect(() => {
    if (!viewerRef.current) return;
    // Measure immediately on attach (covers the very first PDF a user opens,
    // where this effect runs before the container existed on the initial render).
    const initialWidth = viewerRef.current.getBoundingClientRect().width;
    if (initialWidth > 0) setPageWidth(Math.max(200, Math.floor(initialWidth)));
    const obs = new ResizeObserver(entries => { for (const e of entries) setPageWidth(Math.max(200, Math.floor(e.contentRect.width))); });
    obs.observe(viewerRef.current);
    return () => obs.disconnect();
  }, [selectedPaper.id, isWebSource, isEmpty]);

  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setPopupVisible(false); return; }
      const text = sel.toString().trim();
      if (!text) { setPopupVisible(false); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelectedText(text);
      // Use viewport-fixed coordinates directly from the selection rect —
      // avoids any confusion from scroll position inside the PDF container.
      const popupHeight = 48;
      const desiredTop = rect.top - popupHeight;
      const clampedTop = Math.max(8, desiredTop);
      setPopupCoords({
        top: clampedTop,
        left: rect.left + rect.width / 2,
        flip: false,
      });
      setPopupVisible(true);
    };
    const v = viewerRef.current;
    v?.addEventListener('mouseup', onMouseUp);
    return () => v?.removeEventListener('mouseup', onMouseUp);
  }, [pageNumber, isWebSource, selectedPaper.id]);

  const PROJECT_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444'];

  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    const newProject = { id: Date.now(), name, color };
    setProjects(prev => [...prev, newProject]);
    setProjectWorkspaces(prev => ({ ...prev, [newProject.id]: { papers: [], notes: [], archivedPapers: [], importedPmids: [] } }));
    setNewProjectName('');
    setShowNewProjectInput(false);
  };

  const handleDeleteProject = (projectId) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setProjectWorkspaces(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    if (activeProjectId === projectId) switchToWorkspace('general');
  };

  // Switching workspaces: save the currently-active workspace's data into
  // projectWorkspaces, then load the target workspace's data into the live state.
  const switchToWorkspace = (targetId) => {
    if (targetId === activeProjectId) { setShowProjectSwitcher(false); return; }
    setProjectWorkspaces(prev => ({
      ...prev,
      [activeProjectId]: { papers, notes, archivedPapers, importedPmids },
    }));
    const target = projectWorkspaces[targetId] || { papers: [], notes: [], archivedPapers: [], importedPmids: [] };
    setPapers(target.papers);
    setNotes(target.notes);
    setArchivedPapers(target.archivedPapers);
    setImportedPmids(target.importedPmids);
    setSelectedPaper(emptyPaperPlaceholder);
    setPageNumber(1); setNumPages(null);
    setSearchResults(null); setTrendData(null); setGapStatementsResults(null);
    setActiveProjectId(targetId);
    setShowProjectSwitcher(false);
  };

  const handleTagClick = (e, paper) => {
    e.stopPropagation();
    const updated = { ...paper, tag: nextTag(paper.tag || 'neutral') };
    setPapers(prev => prev.map(p => p.id === paper.id ? updated : p));
    if (selectedPaper.id === paper.id) setSelectedPaper(updated);
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleAutoDetectURL = async () => {
    const url = metadataForm.url?.trim();
    if (!url) return;
    setUrlDetecting(true);
    setFetchStatus('🔍 Reading webpage to detect title, organization, year...');
    const meta = await fetchWebpageMeta(url);
    if (meta) {
      setMetadataForm(prev => ({
        ...prev,
        title: meta.title || prev.title,
        organization: meta.organization || prev.organization,
        authors: meta.authors || prev.authors,
        year: meta.year || prev.year,
        accessDate: meta.accessDate || prev.accessDate,
      }));
      setFetchStatus('✅ Webpage details detected! Please check and confirm.');
    } else {
      setFetchStatus('⚠️ Could not auto-detect from this URL. Please fill in manually.');
    }
    setUrlDetecting(false);
  };

  const handleAddWebSource = () => {
    setIsNewWebSource(true);
    setMetadataForm({ title: '', ...emptyMeta, sourceType: 'webpage' });
    setPendingPaper(null);
    setEditingPaper(null);
    setFetchStatus('💡 Paste the URL below and click Auto-detect to fill in details automatically.');
    setMetadataFormVisible(true);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') { alert('Please select a valid PDF file'); return; }
    const fileUrl = URL.createObjectURL(file);
    const newPaper = { id: Date.now(), title: file.name.replace('.pdf', ''), file: fileUrl, fileType: 'pdf', ...emptyMeta };
    setPendingPaper(newPaper);
    setIsNewWebSource(false);
    setFetchingMeta(true);
    setFetchStatus('🔍 Reading PDF to find DOI...');
    setMetadataForm({ title: newPaper.title, ...emptyMeta });
    setMetadataFormVisible(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
    try {
      const text = await extractTextFromPDF(fileUrl);
      const doi = extractDOI(text);
      if (doi) {
        setFetchStatus('🔍 DOI found — searching databases...');
        const result = await fetchMetadata(doi, setFetchStatus);
        if (result) {
          setMetadataForm(prev => ({ ...prev, ...result.meta, sourceType: 'journal' }));
          setFetchStatus(`✅ Found via ${result.source}! Please check and confirm.`);
        } else {
          setMetadataForm(prev => ({ ...prev, doi }));
          setFetchStatus('⚠️ DOI found but not in any database. DOI pre-filled.');
        }
      } else {
        setFetchStatus('⚠️ No DOI found. Please fill in details manually.');
      }
    } catch { setFetchStatus('⚠️ Auto-detection failed. Please fill in manually.'); }
    setFetchingMeta(false);
  };

  const handleMetadataSave = () => {
    if (isNewWebSource) {
      // Creating a new web source — no PDF file
      const newWebSource = {
        id: Date.now(),
        title: metadataForm.title || 'Web source',
        file: null,
        fileType: 'web',
        ...metadataForm
      };
      const dup = findDuplicatePaper([...papers, ...archivedPapers], newWebSource);
      if (dup) { setDuplicateWarning({ existingPaper: dup, candidate: newWebSource, kind: 'web' }); return; }
      setPapers(prev => [newWebSource, ...prev]);
      setSelectedPaper(newWebSource);
      setWebQuoteText('');
      setIsNewWebSource(false);
      setMetadataFormVisible(false); setFetchStatus('');
    } else if (editingPaper) {
      const paperWithMeta = { ...editingPaper, ...metadataForm };
      setPapers(prev => prev.map(p => p.id === editingPaper.id ? paperWithMeta : p));
      if (selectedPaper.id === editingPaper.id) setSelectedPaper(paperWithMeta);
      setEditingPaper(null);
      setMetadataFormVisible(false); setFetchStatus('');
    } else {
      const paperWithMeta = { ...pendingPaper, ...metadataForm };
      const dup = findDuplicatePaper([...papers, ...archivedPapers], paperWithMeta);
      if (dup) { setDuplicateWarning({ existingPaper: dup, candidate: paperWithMeta, kind: 'pdf' }); return; }
      setPapers(prev => [paperWithMeta, ...prev]);
      setSelectedPaper(paperWithMeta);
      setPageNumber(1); setNumPages(null); setPendingPaper(null);
      setMetadataFormVisible(false); setFetchStatus('');
    }
  };

  const confirmAddDuplicate = () => {
    if (!duplicateWarning) return;
    const { candidate, kind, pmid } = duplicateWarning;
    setPapers(prev => [candidate, ...prev]);
    setSelectedPaper(candidate);
    if (kind === 'pdf') { setPageNumber(1); setNumPages(null); setPendingPaper(null); }
    else if (kind === 'web') { setWebQuoteText(''); setIsNewWebSource(false); }
    else if (kind === 'pubmed') { setImportedPmids(prev => [...prev, pmid]); }
    setDuplicateWarning(null);
    setMetadataFormVisible(false); setFetchStatus('');
  };

  const cancelAddDuplicate = (goToExisting) => {
    if (goToExisting && duplicateWarning) {
      const existing = papers.find(p => p.id === duplicateWarning.existingPaper.id);
      if (existing) setSelectedPaper(existing);
    }
    setDuplicateWarning(null);
    setIsNewWebSource(false);
    setPendingPaper(null);
    setMetadataFormVisible(false); setFetchStatus('');
  };

  const handleMetadataSkip = () => {
    if (isNewWebSource) { setIsNewWebSource(false); }
    else if (editingPaper) { setEditingPaper(null); }
    else if (pendingPaper) {
      setPapers(prev => [pendingPaper, ...prev]);
      setSelectedPaper(pendingPaper);
      setPageNumber(1); setNumPages(null); setPendingPaper(null);
    }
    setMetadataFormVisible(false); setFetchStatus('');
  };

  const handleEditPaper = (e, paper) => {
    e.stopPropagation();
    setEditingPaper(paper);
    setIsNewWebSource(false);
    setFetchStatus('');
    setMetadataForm({ title: paper.title, ...emptyMeta, ...paper });
    setMetadataFormVisible(true);
  };

  const handleAttachPdfClick = () => attachPdfInputRef.current?.click();

  const handleAttachPdf = async (event) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') { alert('Please select a valid PDF file'); return; }
    const fileUrl = URL.createObjectURL(file);
    const paperBeingAttached = selectedPaper;

    // Check if the actual PDF content matches the saved metadata before attaching
    try {
      const text = await extractTextFromPDF(fileUrl);
      const detectedDoi = extractDOI(text);
      const savedDoi = (paperBeingAttached.doi || '').toLowerCase().trim();
      if (detectedDoi && savedDoi && detectedDoi.toLowerCase().trim() !== savedDoi) {
        // DOIs disagree — likely the wrong PDF was attached. Warn before proceeding.
        setMismatchWarning({
          paper: paperBeingAttached,
          fileUrl,
          detectedDoi,
          savedDoi: paperBeingAttached.doi,
          savedTitle: paperBeingAttached.title,
        });
        if (attachPdfInputRef.current) attachPdfInputRef.current.value = '';
        return;
      }
    } catch { /* if detection fails, just proceed without blocking */ }

    finishAttachPdf(paperBeingAttached, fileUrl);
    if (attachPdfInputRef.current) attachPdfInputRef.current.value = '';
  };

  const finishAttachPdf = (paperBeingAttached, fileUrl) => {
    const updated = { ...paperBeingAttached, file: fileUrl, fileType: 'pdf' };
    setPapers(prev => prev.map(p => p.id === paperBeingAttached.id ? updated : p));
    setSelectedPaper(updated);
    setPageNumber(1);
    setNumPages(null);
    // The pdf-container only mounts after this state update causes a re-render
    // (we were showing the web-source view before). Poll briefly until the ref
    // is attached and has a real width, then measure it exactly like the
    // ResizeObserver does (contentRect.width) so sizing matches normal uploads.
    let attempts = 0;
    const tryMeasure = () => {
      attempts++;
      if (viewerRef.current) {
        const width = viewerRef.current.getBoundingClientRect().width;
        if (width > 0) {
          setPageWidth(Math.max(200, Math.floor(width)));
          return;
        }
      }
      if (attempts < 20) requestAnimationFrame(tryMeasure);
    };
    requestAnimationFrame(tryMeasure);
  };

  const confirmAttachAnyway = () => {
    if (!mismatchWarning) return;
    finishAttachPdf(mismatchWarning.paper, mismatchWarning.fileUrl);
    setMismatchWarning(null);
  };

  const cancelMismatchAttach = () => setMismatchWarning(null);

  const handleSelectPaper = (paper) => {
    setSelectedPaper(paper); setPageNumber(1); setNumPages(null);
    setSelectedText(''); setPopupVisible(false);
    setWebQuoteText('');
    window.getSelection()?.removeAllRanges();
  };

  const onDocumentLoadSuccess = ({ numPages: n }) => { setNumPages(n); if (pageNumber > n) setPageNumber(n); };

  const handleSaveSelection = () => {
    if (!selectedText) return;
    let selY = null;
    try { const s = window.getSelection(); if (s?.rangeCount > 0) selY = s.getRangeAt(0).getBoundingClientRect().top; } catch {}
    setNotes(prev => [{ id: Date.now(), text: selectedText, page: pageNumber, paperId: selectedPaper.id, paperName: selectedPaper.title, paperUrl: selectedPaper.url || null, fileType: selectedPaper.fileType || 'pdf', projectId: selectedPaper.projectId || null, y: selY }, ...prev]);
    setSelectedText(''); setPopupVisible(false); window.getSelection()?.removeAllRanges();
  };

  const handleSaveWebQuote = () => {
    if (!webQuoteText.trim()) return;
    setNotes(prev => [{ id: Date.now(), text: webQuoteText.trim(), page: null, paperId: selectedPaper.id, paperName: selectedPaper.title, paperUrl: selectedPaper.url || null, fileType: 'web', projectId: selectedPaper.projectId || null, y: null }, ...prev]);
    setWebQuoteText('');
  };

  const handleNoteClick = (note) => {
    // If the paper was archived (removed from sidebar but kept for notes),
    // restore it to the visible library first so it can be opened.
    const archived = archivedPapers.find(p => p.id === note.paperId);
    if (archived) {
      setPapers(prev => [archived, ...prev]);
      setArchivedPapers(prev => prev.filter(p => p.id !== archived.id));
      setSelectedPaper(archived);
      setActiveView('library');
    } else {
      const livePaper = papers.find(p => p.id === note.paperId);
      if (livePaper) { setSelectedPaper(livePaper); setActiveView('library'); }
    }

    if (note.fileType === 'web' && note.paperUrl) {
      // Open URL in new tab to verify source
      window.open(note.paperUrl, '_blank', 'noopener,noreferrer');
    } else if (note.fileType === 'pdf') {
      // Jump to page in PDF
      setPageNumber(note.page);
      if (note.y && viewerRef.current) {
        setTimeout(() => {
          const cr = viewerRef.current.getBoundingClientRect();
          viewerRef.current.scrollTop += Math.max(0, note.y - cr.top - 20);
        }, 200);
      }
    }
  };

  const handleCancelSelection = () => { setSelectedText(''); setPopupVisible(false); window.getSelection()?.removeAllRanges(); };
  const handleDeleteNote = (id) => setNotes(prev => prev.filter(n => n.id !== id));

  const handleDeletePaperClick = (e, paper) => {
    e.stopPropagation();
    const noteCount = notes.filter(n => n.paperId === paper.id).length;
    if (noteCount === 0) {
      // No notes attached — just remove it, no warning needed
      removePaperCompletely(paper);
    } else {
      setDeleteConfirm({ paper, noteCount });
    }
  };

  const removePaperCompletely = (paper) => {
    setPapers(prev => prev.filter(p => p.id !== paper.id));
    setNotes(prev => prev.filter(n => n.paperId !== paper.id));
    setArchivedPapers(prev => prev.filter(p => p.id !== paper.id));
    if (selectedPaper.id === paper.id && papers.length > 1) {
      const next = papers.find(p => p.id !== paper.id);
      if (next) setSelectedPaper(next);
    }
    setDeleteConfirm(null);
  };

  const removePaperButKeepNotes = (paper) => {
    setPapers(prev => prev.filter(p => p.id !== paper.id));
    setArchivedPapers(prev => [...prev, paper]);
    if (selectedPaper.id === paper.id) {
      const next = papers.find(p => p.id !== paper.id);
      if (next) setSelectedPaper(next);
    }
    setDeleteConfirm(null);
  };

  const handlePreviousPage = () => { setPageNumber(prev => Math.max(1, prev - 1)); setPopupVisible(false); };
  const handleNextPage = () => { if (!numPages) return; setPageNumber(prev => Math.min(numPages, prev + 1)); setPopupVisible(false); };
  const handleZoomIn = () => setZoom(prev => prev + 0.2);
  const handleZoomOut = () => setZoom(prev => Math.max(0.2, prev - 0.2));

  const handleCiteClick = (e, paper) => { e.stopPropagation(); setCitationPaper(paper); setCitationPopupVisible(true); };
  const handleCloseCitationPopup = () => setCitationPopupVisible(false);
  const handleCopyCitation = (text) => { navigator.clipboard.writeText(text); setCopiedFormat(text); setTimeout(() => setCopiedFormat(null), 2000); };

  useEffect(() => {
    const h = e => { if (citationPopupRef.current && !citationPopupRef.current.contains(e.target)) handleCloseCitationPopup(); };
    if (citationPopupVisible) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [citationPopupVisible]);

  const getPaperRefNum = (paperName) => {
    const seen = [];
    for (const n of notes) { if (!seen.includes(n.paperName)) seen.push(n.paperName); }
    return seen.indexOf(paperName) + 1;
  };

  const generateReferenceList = (style) => {
    const seen = [];
    for (const n of notes) { if (!seen.includes(n.paperName)) seen.push(n.paperName); }
    let uniquePapers = seen.map(name => papers.find(p => p.title === name) || archivedPapers.find(p => p.title === name) || { ...emptyMeta, title: name });
    if (style === 'apa') uniquePapers = [...uniquePapers].sort((a, b) => (a.authors || a.organization || a.title).localeCompare(b.authors || b.organization || b.title));
    const cites = uniquePapers.map((p, i) => {
      const c = generateCitations(p);
      return `${i + 1}. ${style === 'apa' ? c.apa : style === 'mla' ? c.mla : c.vancouver}`;
    });
    setGeneratedReferences(cites.join('\n\n'));
  };

  const handleGenerateReferences = () => { setReferencePopupVisible(true); setReferenceStyle(null); };
  const handleSelectReferenceStyle = (style) => { setReferenceStyle(style); generateReferenceList(style); };
  const handleCloseReferencePopup = () => { setReferencePopupVisible(false); setReferenceStyle(null); setGeneratedReferences(''); };
  const handleCopyReferences = () => { navigator.clipboard.writeText(generatedReferences); setReferenceCopied(true); setTimeout(() => setReferenceCopied(false), 2000); };

  useEffect(() => {
    const h = e => { if (referencePopupRef.current && !referencePopupRef.current.contains(e.target)) handleCloseReferencePopup(); };
    if (referencePopupVisible) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [referencePopupVisible]);

  const currentFields = FIELDS[metadataForm.sourceType] || FIELDS.journal;

  // ─── Gap Finder handlers ─────────────────────────────────────────────────
  const handleSearchPubMed = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    setTrendData(null);
    setGapStatementsResults(null);
    const result = await searchPubMed(searchQuery.trim());
    setSearchResults(result);
    setSearching(false);

    setLoadingTrend(true);
    const currentYear = new Date().getFullYear();
    const trend = await getPublicationTrend(searchQuery.trim(), currentYear - 9, currentYear);
    setTrendData(trend);
    setLoadingTrend(false);
  };

  const handleFindGapStatements = async () => {
    if (!searchQuery.trim()) return;
    setSearchingGapStatements(true);
    setFetchStatus('');
    const result = await searchPubMedWithAbstracts(searchQuery.trim());
    if (!result) { setGapStatementsResults([]); setSearchingGapStatements(false); return; }

    // For each paper, try to get free full-text Discussion/Limitations from PMC.
    // Falls back to abstract-only scanning when no free full text exists.
    const enriched = await Promise.all(result.papers.map(async (p) => {
      const pmcid = await getPmcId(p.pmid);
      let fullTextUsed = false;
      let scanText = p.abstract;
      if (pmcid) {
        const discussionText = await fetchPmcDiscussionText(pmcid);
        if (discussionText) {
          scanText = p.abstract + ' ' + discussionText;
          fullTextUsed = true;
        }
      }
      const lowerText = scanText.toLowerCase();
      const foundPhrases = GAP_PHRASES.filter(phrase => lowerText.includes(phrase));
      return { ...p, gapPhrases: foundPhrases, fullTextUsed, pmcid };
    }));

    setGapStatementsResults(enriched.filter(p => p.gapPhrases.length > 0));
    setSearchingGapStatements(false);
  };

  const handleImportPaper = (pubmedPaper) => {
    const newPaper = {
      id: Date.now() + Math.random(),
      title: pubmedPaper.title,
      file: null,
      fileType: 'web',
      tag: 'neutral',
      sourceType: 'journal',
      authors: pubmedPaper.authors,
      organization: '',
      journal: pubmedPaper.journal,
      year: pubmedPaper.year,
      volume: pubmedPaper.volume,
      issue: pubmedPaper.issue,
      pages: pubmedPaper.pages,
      doi: pubmedPaper.doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pubmedPaper.pmid}/`,
      city: '', publisher: '', edition: '', accessDate: '', newspaper: '', newsDate: '', thesisType: 'master', university: '', reportSeries: '',
    };
    const dup = findDuplicatePaper([...papers, ...archivedPapers], newPaper);
    if (dup) {
      setDuplicateWarning({ existingPaper: dup, candidate: newPaper, kind: 'pubmed', pmid: pubmedPaper.pmid });
      return;
    }
    setPapers(prev => [newPaper, ...prev]);
    setImportedPmids(prev => [...prev, pubmedPaper.pmid]);
  };

  return (
    <div className="app-shell" style={{ height: '100vh', overflow: 'hidden' }}>
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        <div className="sidebar-header" style={{ flexShrink: 0, position: 'relative' }}>
          <h1>Research Tool</h1>
          <button onClick={() => setShowProjectSwitcher(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px 10px', cursor: 'pointer', color: '#fff' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.85rem', fontWeight: '600' }}>
              {activeProjectId !== 'general' && (
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: projects.find(p => p.id === activeProjectId)?.color || '#9ca3af', display: 'inline-block' }} />
              )}
              {activeProjectId === 'general' ? '📁 General' : projects.find(p => p.id === activeProjectId)?.name || 'Project'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>▼</span>
          </button>

          {showProjectSwitcher && (
            <div style={{ position: 'absolute', top: '100%', left: '16px', right: '16px', marginTop: '4px', background: '#1f2937', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', boxShadow: '0 12px 30px rgba(0,0,0,0.4)', zIndex: 50, padding: '6px' }}>
              <button onClick={() => switchToWorkspace('general')} style={{ width: '100%', textAlign: 'left', padding: '7px 9px', borderRadius: '6px', border: 'none', background: activeProjectId === 'general' ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}>
                📁 General
              </button>
              {projects.map(proj => (
                <div key={proj.id} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <button onClick={() => switchToWorkspace(proj.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '7px', textAlign: 'left', padding: '7px 9px', borderRadius: '6px', border: 'none', background: activeProjectId === proj.id ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: proj.color, display: 'inline-block', flexShrink: 0 }} />
                    {proj.name}
                  </button>
                  <button onClick={() => handleDeleteProject(proj.id)} title="Delete project" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem', padding: '4px 8px' }}>×</button>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '4px', paddingTop: '4px' }}>
                {showNewProjectInput ? (
                  <div style={{ display: 'flex', gap: '4px', padding: '4px' }}>
                    <input type="text" autoFocus value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                      placeholder="Project name" style={{ flex: 1, padding: '5px 8px', borderRadius: '5px', border: '1px solid #4b5563', background: '#111827', color: '#fff', fontSize: '0.78rem' }} />
                    <button onClick={handleCreateProject} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 9px', cursor: 'pointer', fontSize: '0.78rem' }}>Add</button>
                  </div>
                ) : (
                  <button onClick={() => setShowNewProjectInput(true)} style={{ width: '100%', background: 'none', border: '1px dashed #4b5563', color: '#9ca3af', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                    + New project
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '4px', padding: '10px 12px 10px' }}>
          <button onClick={() => setActiveView('library')} style={{ flex: 1, padding: '7px', borderRadius: '6px', border: 'none', background: activeView === 'library' ? 'rgba(255,255,255,0.15)' : 'transparent', color: activeView === 'library' ? '#fff' : '#9ca3af', cursor: 'pointer', fontSize: '0.78rem', fontWeight: activeView === 'library' ? '600' : '400' }}>
            📚 Library
          </button>
          <button onClick={() => setActiveView('gapfinder')} style={{ flex: 1, padding: '7px', borderRadius: '6px', border: 'none', background: activeView === 'gapfinder' ? 'rgba(255,255,255,0.15)' : 'transparent', color: activeView === 'gapfinder' ? '#fff' : '#9ca3af', cursor: 'pointer', fontSize: '0.78rem', fontWeight: activeView === 'gapfinder' ? '600' : '400' }}>
            🔍 Gap Finder
          </button>
        </div>

        <button className="upload-button" onClick={handleUploadClick}>+ Upload PDF</button>
        <button onClick={handleAddWebSource} style={{ width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#e5e7eb', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', marginTop: '8px', marginBottom: '4px' }}>
          🌐 Add Web Source
        </button>
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />

        <div className="paper-list">
          {papers.map(paper => {
            const tag = TAG_CONFIG[paper.tag || 'neutral'];
            return (
              <div key={paper.id} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button className={`paper-item ${selectedPaper.id === paper.id ? 'active' : ''}`} onClick={() => handleSelectPaper(paper)} style={{ flex: 1, textAlign: 'left' }}>
                    {paper.fileType === 'web' ? '🌐 ' : ''}{paper.title}
                  </button>
                  <button onClick={e => handleEditPaper(e, paper)} title="Edit metadata" style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem', padding: '4px 5px', borderRadius: '4px' }} onMouseOver={e => e.target.style.color = '#fff'} onMouseOut={e => e.target.style.color = '#9ca3af'}>✏️</button>
                  <button onClick={e => handleCiteClick(e, paper)} style={{ background: 'none', border: 'none', color: '#e5e7eb', cursor: 'pointer', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px' }} onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.1)'} onMouseOut={e => e.target.style.background = 'none'}>Cite</button>
                  <button onClick={e => handleDeletePaperClick(e, paper)} title="Remove from library" style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem', padding: '4px 5px', borderRadius: '4px' }} onMouseOver={e => { e.target.style.color = '#ef4444'; }} onMouseOut={e => { e.target.style.color = '#9ca3af'; }}>🗑️</button>
                </div>
                <button onClick={e => handleTagClick(e, paper)}
                  title="Click to change tag"
                  style={{ marginTop: '3px', marginLeft: '2px', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', border: `1px solid ${tag.border}`, background: tag.bg, color: tag.color, cursor: 'pointer', fontWeight: '500' }}>
                  {tag.label}
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="viewer-area" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {activeView === 'gapfinder' ? (
          <div style={{ flex: 1, padding: '20px 28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px' }}>Research Gap Finder</h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>Search PubMed to see publication trends and find your research gap</p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchPubMed()}
                placeholder="e.g. smart diaper wetness sensor infant"
                style={{ flex: 1, padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              <button onClick={handleSearchPubMed} disabled={searching || !searchQuery.trim()}
                style={{ padding: '10px 20px', background: searching || !searchQuery.trim() ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: searching || !searchQuery.trim() ? 'not-allowed' : 'pointer', fontSize: '0.9rem', fontWeight: '600' }}>
                {searching ? 'Searching...' : 'Search PubMed'}
              </button>
            </div>

            {searchResults && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Total papers found</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '600', color: '#1e293b' }}>{searchResults.totalCount?.toLocaleString() || 0}</div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Showing top results</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '600', color: '#1e293b' }}>{searchResults.papers?.length || 0}</div>
                </div>
              </div>
            )}

            {(loadingTrend || trendData) && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>Publications per year (last 10 years)</div>
                {loadingTrend ? (
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>🔍 Loading trend data from PubMed...</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px' }}>
                    {Object.entries(trendData).map(([year, count]) => {
                      const maxCount = Math.max(...Object.values(trendData), 1);
                      const heightPct = Math.max(4, (count / maxCount) * 100);
                      return (
                        <div key={year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <div title={`${count} papers in ${year}`} style={{ width: '100%', maxWidth: '32px', height: `${heightPct}%`, background: '#93c5fd', borderRadius: '4px 4px 0 0', minHeight: '3px' }} />
                          <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '4px' }}>{year.slice(2)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {searchResults && (
              <div>
                <button onClick={handleFindGapStatements} disabled={searchingGapStatements}
                  style={{ padding: '10px 16px', background: searchingGapStatements ? '#fde68a' : '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '8px', cursor: searchingGapStatements ? 'wait' : 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
                  {searchingGapStatements ? '🔍 Reading abstracts and full text where available...' : '🔍 Find papers that mention a research gap'}
                </button>
                <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '4px' }}>Scans abstracts — and full Discussion/Limitations sections when free full text is available on PubMed Central — for phrases like "further research is needed" or "limited data on"</div>
              </div>
            )}

            {gapStatementsResults !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>
                  {gapStatementsResults.length > 0 ? `${gapStatementsResults.length} paper${gapStatementsResults.length > 1 ? 's' : ''} explicitly mention a gap` : 'No explicit gap statements found'}
                </div>
                {gapStatementsResults.map(p => {
                  const imported = importedPmids.includes(p.pmid);
                  return (
                    <div key={p.pmid} style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', marginBottom: '4px', lineHeight: '1.4' }}>{p.title}</div>
                        <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', padding: '2px 7px', borderRadius: '8px', background: p.fullTextUsed ? '#dcfce7' : '#f3f4f6', color: p.fullTextUsed ? '#16a34a' : '#6b7280', border: `1px solid ${p.fullTextUsed ? '#86efac' : '#d1d5db'}` }}>
                          {p.fullTextUsed ? '✓ full text scanned' : 'abstract only'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '6px' }}>{p.authors} · {p.journal} · {p.year}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {p.gapPhrases.map(phrase => (
                          <span key={phrase} style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', border: '1px solid #fde68a' }}>"{phrase}"</span>
                        ))}
                      </div>
                      <button onClick={() => handleImportPaper(p)} disabled={imported}
                        style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: '6px', border: 'none', background: imported ? '#dcfce7' : '#2563eb', color: imported ? '#16a34a' : '#fff', cursor: imported ? 'default' : 'pointer', fontWeight: '600' }}>
                        {imported ? '✓ Imported' : '+ Import to library'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {searchResults?.papers?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}>Papers found</div>
                {searchResults.papers.map(p => {
                  const imported = importedPmids.includes(p.pmid);
                  return (
                    <div key={p.pmid} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', marginBottom: '4px', lineHeight: '1.4' }}>{p.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '8px' }}>{p.authors} · {p.journal} · {p.year}</div>
                      <button onClick={() => handleImportPaper(p)} disabled={imported}
                        style={{ fontSize: '0.75rem', padding: '5px 12px', borderRadius: '6px', border: 'none', background: imported ? '#dcfce7' : '#2563eb', color: imported ? '#16a34a' : '#fff', cursor: imported ? 'default' : 'pointer', fontWeight: '600' }}>
                        {imported ? '✓ Imported' : '+ Import to library'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {!searchResults && !searching && (
              <div style={{ fontSize: '0.85rem', color: '#6b7280', background: '#f9fafb', border: '1px dashed #e5e7eb', borderRadius: '8px', padding: '14px', lineHeight: '1.6' }}>
                💡 <strong>Tip:</strong> Search a topic related to your research idea. The trend chart shows if the field is growing, shrinking, or has a gap nobody has studied — that gap could become your unique research angle.
              </div>
            )}
          </div>
        ) : isEmpty ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#9ca3af', padding: '40px' }}>
            <div style={{ fontSize: '2.5rem' }}>📚</div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280' }}>Your library is empty</div>
            <div style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: '320px', lineHeight: '1.5' }}>
              Upload a PDF, add a web source, or search PubMed in the Gap Finder tab to get started.
            </div>
          </div>
        ) : (
        <>
        <div className="viewer-header" style={{ flexShrink: 0 }}>
          <div>
            <h2>{selectedPaper.title}</h2>
            {isWebSource ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p style={{ margin: 0 }}>🌐 Web source</p>
                {selectedPaper.url && (
                  <a href={selectedPaper.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#2563eb', textDecoration: 'none' }}>
                    Open website ↗
                  </a>
                )}
              </div>
            ) : (
              <p>Page {pageNumber}{numPages ? ` of ${numPages}` : ''}</p>
            )}
          </div>
        </div>

        {isWebSource ? (
          /* Web source view — paste quotes here, or attach a PDF */
          <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

            {selectedPaper.url && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1d4ed8', marginBottom: '4px' }}>
                  {selectedPaper.url.includes('pubmed') ? '📄 View on PubMed' : 'Source URL'}
                </div>
                <a href={selectedPaper.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.82rem', color: '#2563eb', wordBreak: 'break-all' }}>
                  {selectedPaper.url}
                </a>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>Click to open and verify the source ↗</div>
              </div>
            )}

            <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#92400e', marginBottom: '6px' }}>📎 Have the PDF for this paper?</div>
              <div style={{ fontSize: '0.78rem', color: '#92400e', marginBottom: '8px' }}>Upload it here to read and highlight directly inside the tool — your saved citation details will stay.</div>
              <button onClick={handleAttachPdfClick} style={{ background: '#fff', border: '1px solid #f59e0b', color: '#92400e', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
                + Attach PDF
              </button>
              <input ref={attachPdfInputRef} type="file" accept=".pdf" onChange={handleAttachPdf} style={{ display: 'none' }} />
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Paste or type a quote from the abstract / source</div>
              <textarea
                value={webQuoteText}
                onChange={e => setWebQuoteText(e.target.value)}
                placeholder="Paste the text you want to save..."
                style={{ width: '100%', minHeight: '120px', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: '1.6' }}
              />
              <button onClick={handleSaveWebQuote} disabled={!webQuoteText.trim()} style={{ marginTop: '10px', background: webQuoteText.trim() ? '#2563eb' : '#93c5fd', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: webQuoteText.trim() ? 'pointer' : 'not-allowed', fontSize: '0.85rem', fontWeight: '600' }}>
                Save to Smart Notes
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f9fafb', border: '1px dashed #e5e7eb', borderRadius: '8px', padding: '12px 14px', lineHeight: '1.6' }}>
              💡 <strong>Tip:</strong> When you click the saved note in Smart Notes, it will open this source in your browser so you can verify it.
            </div>
          </div>
        ) : (
          /* PDF view */
          <div className="pdf-container" ref={viewerRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', minHeight: 0, position: 'relative' }}>
            <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess}>
              <Page
                pageNumber={pageNumber}
                width={pageWidth * zoom}
                renderTextLayer={true}
                renderAnnotationLayer={false}
                devicePixelRatio={Math.max(2, (window.devicePixelRatio || 1) * zoom)}
              />
            </Document>
            {popupVisible && (
              <div style={{ position: 'fixed', top: popupCoords.top, left: popupCoords.left, transform: 'translate(-50%, 0)', zIndex: 2000, display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(156,163,175,0.35)', borderRadius: '12px', padding: '8px', boxShadow: '0 16px 40px rgba(15,23,42,0.18)' }}>
                <button className="page-button" onClick={handleSaveSelection} style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}>Save</button>
                <button className="page-button" onClick={handleCancelSelection} style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}>Cancel</button>
              </div>
            )}
          </div>
        )}

        {!isWebSource && (
          <div className="page-controls" style={{ flexShrink: 0 }}>
            <button className="page-button" onClick={handlePreviousPage} disabled={pageNumber === 1}>← Previous</button>
            <button className="page-button" onClick={handleNextPage} disabled={!numPages || pageNumber === numPages}>Next →</button>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="page-button" onClick={handleZoomOut}>−</button>
              <span style={{ minWidth: '50px', textAlign: 'center', fontSize: '0.85rem' }}>{Math.round(zoom * 100)}%</span>
              <button className="page-button" onClick={handleZoomIn}>+</button>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      <aside className="notes-panel" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <div className="notes-header" style={{ flexShrink: 0 }}>
          <h2>Smart Notes</h2>
          <p>
            {activeProjectId === 'general' ? 'Saved text selections appear here.' :
             `Notes for "${projects.find(p => p.id === activeProjectId)?.name || ''}"`}
          </p>
        </div>
        <div className="notes-list" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {notes.length === 0 ? <div className="notes-empty">No saved selections yet for this project. Select text from a PDF or paste a web quote.</div> : notes.map(note => {
            const isArchived = archivedPapers.some(p => p.id === note.paperId);
            return (
            <div key={note.id} className="note-card" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => handleNoteClick(note)}>
              <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#2563eb', marginBottom: '4px' }}>[{getPaperRefNum(note.paperName)}]</div>
              <button onClick={e => { e.stopPropagation(); handleDeleteNote(note.id); }} style={{ position: 'absolute', top: '4px', right: '4px', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1rem', padding: '2px 6px', borderRadius: '4px' }} onMouseOver={e => { e.target.style.color = '#ef4444'; e.target.style.background = '#fee2e2'; }} onMouseOut={e => { e.target.style.color = '#999'; e.target.style.background = 'none'; }}>×</button>
              {isArchived && (
                <div style={{ fontSize: '0.7rem', color: '#92400e', background: '#fef3c7', display: 'inline-block', padding: '1px 7px', borderRadius: '8px', marginBottom: '4px' }}>
                  📦 Removed from sidebar — click to reopen
                </div>
              )}
              {note.fileType === 'web' ? (
                <div style={{ fontSize: '0.72rem', color: '#2563eb', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🌐 Web source — <span style={{ textDecoration: 'underline' }}>click to open ↗</span>
                </div>
              ) : (
                <div className="note-page">Page {note.page}</div>
              )}
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '6px' }}>{note.paperName}</div>
              <p>{note.text}</p>
            </div>
            );
          })}
        </div>
        {notes.length > 0 && <button onClick={handleGenerateReferences} style={{ flexShrink: 0, width: '100%', background: '#2563eb', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', marginTop: '12px' }}>Generate References</button>}
      </aside>

      {/* DUPLICATE PAPER WARNING */}
      {duplicateWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '440px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.05rem' }}>📚 This paper is already in your library</h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '12px', lineHeight: '1.5' }}>
              It looks like <strong>"{duplicateWarning.existingPaper.title}"</strong> is already saved
              {duplicateWarning.existingPaper.doi ? ' (same DOI)' : ' (same title)'}. Adding it again will create a duplicate and split your notes across two entries.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => cancelAddDuplicate(true)}
                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', textAlign: 'left' }}>
                Go to the existing paper instead
              </button>
              <button onClick={confirmAddDuplicate}
                style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', textAlign: 'left' }}>
                Add anyway (I want two separate entries)
              </button>
              <button onClick={() => cancelAddDuplicate(false)}
                style={{ background: '#f3f4f6', border: '1px solid #d1d5db', color: '#374151', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOI MISMATCH WARNING when attaching a PDF */}
      {mismatchWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '460px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.05rem' }}>⚠️ This PDF doesn't match the saved paper</h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '12px', lineHeight: '1.5' }}>
              You're attaching a PDF to <strong>"{mismatchWarning.savedTitle}"</strong>, but the PDF itself contains a different DOI than the one saved for this entry.
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '0.78rem' }}>
              <div style={{ marginBottom: '4px' }}><strong>Saved DOI:</strong> {mismatchWarning.savedDoi}</div>
              <div><strong>DOI found in this PDF:</strong> {mismatchWarning.detectedDoi}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={cancelMismatchAttach}
                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', textAlign: 'left' }}>
                Cancel — let me check the file
              </button>
              <button onClick={confirmAttachAnyway}
                style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', textAlign: 'left' }}>
                Attach anyway (I'm sure this is correct)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PAPER CONFIRMATION */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '1.05rem' }}>Remove "{deleteConfirm.paper.title}"?</h3>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '18px', lineHeight: '1.5' }}>
              You have <strong>{deleteConfirm.noteCount} saved note{deleteConfirm.noteCount > 1 ? 's' : ''}</strong> from this paper. What would you like to do?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => removePaperButKeepNotes(deleteConfirm.paper)}
                style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', textAlign: 'left' }}>
                Remove from sidebar, but keep my notes
                <div style={{ fontSize: '0.75rem', fontWeight: '400', color: '#3b82f6', marginTop: '2px' }}>Clicking a note later will bring this paper back automatically</div>
              </button>
              <button onClick={() => removePaperCompletely(deleteConfirm.paper)}
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', textAlign: 'left' }}>
                Delete paper AND its notes
                <div style={{ fontSize: '0.75rem', fontWeight: '400', color: '#ef4444', marginTop: '2px' }}>This cannot be undone</div>
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ background: '#f3f4f6', border: '1px solid #d1d5db', color: '#374151', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* METADATA FORM */}
      {metadataFormVisible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '92vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '6px', fontSize: '1.1rem' }}>{editingPaper ? 'Edit Source Details' : isNewWebSource ? 'Add Web Source' : 'Source Details'}</h3>
            {fetchStatus && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.82rem', background: fetchStatus.startsWith('✅') ? '#ecfdf5' : fetchStatus.startsWith('🔍') ? '#eff6ff' : '#fef3c7', color: fetchStatus.startsWith('✅') ? '#065f46' : fetchStatus.startsWith('🔍') ? '#1e40af' : '#92400e', border: `1px solid ${fetchStatus.startsWith('✅') ? '#6ee7b7' : fetchStatus.startsWith('🔍') ? '#93c5fd' : '#fcd34d'}` }}>
                {fetchStatus}
              </div>
            )}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>Source Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {SOURCE_TYPES.map(({ value, label }) => (
                  <button key={value} onClick={() => setMetadataForm(prev => ({ ...prev, sourceType: value }))}
                    style={{ padding: '7px 6px', borderRadius: '6px', border: `2px solid ${metadataForm.sourceType === value ? '#2563eb' : '#e5e7eb'}`, background: metadataForm.sourceType === value ? '#eff6ff' : '#f9fafb', color: metadataForm.sourceType === value ? '#1d4ed8' : '#374151', cursor: 'pointer', fontSize: '0.75rem', fontWeight: metadataForm.sourceType === value ? '600' : '400' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', marginBottom: '3px', color: '#374151' }}>Title</label>
              <input type="text" value={metadataForm.title || ''} onChange={e => setMetadataForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Title of the source"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
            </div>
            {metadataForm.sourceType === 'thesis' && (
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>Thesis Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[{ value: 'master', label: "Master's thesis" }, { value: 'doctoral', label: 'Doctoral dissertation' }].map(({ value, label }) => (
                    <button key={value} onClick={() => setMetadataForm(prev => ({ ...prev, thesisType: value }))}
                      style={{ flex: 1, padding: '7px', borderRadius: '6px', border: `2px solid ${metadataForm.thesisType === value ? '#2563eb' : '#e5e7eb'}`, background: metadataForm.thesisType === value ? '#eff6ff' : '#f9fafb', color: metadataForm.thesisType === value ? '#1d4ed8' : '#374151', cursor: 'pointer', fontSize: '0.8rem', fontWeight: metadataForm.thesisType === value ? '600' : '400' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {currentFields.map(key => {
              const cfg = FIELD_CONFIG[key];
              if (!cfg) return null;
              const isURLField = key === 'url';
              return (
                <div key={key} style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', marginBottom: '3px', color: '#374151' }}>{cfg.label}</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" value={metadataForm[key] || ''} onChange={e => setMetadataForm(prev => ({ ...prev, [key]: e.target.value }))} placeholder={cfg.placeholder}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }} />
                    {isURLField && (metadataForm.sourceType === 'webpage' || metadataForm.sourceType === 'report') && (
                      <button onClick={handleAutoDetectURL} disabled={!metadataForm.url?.trim() || urlDetecting}
                        style={{ padding: '7px 10px', background: metadataForm.url?.trim() ? '#2563eb' : '#e5e7eb', color: metadataForm.url?.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: '6px', cursor: metadataForm.url?.trim() ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {urlDetecting ? '...' : '🔍 Auto-detect'}
                      </button>
                    )}
                  </div>
                  {isURLField && (metadataForm.sourceType === 'webpage' || metadataForm.sourceType === 'report') && (
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '3px' }}>Paste the URL first then click Auto-detect to fill in title, organization and year automatically</div>
                  )}
                </div>
              );
            })}
            {(metadataForm.authors || metadataForm.organization) && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Preview (Vancouver)</div>
                <div style={{ fontSize: '0.78rem', color: '#1e293b', lineHeight: '1.5' }}>{generateCitations({ ...metadataForm, title: metadataForm.title || 'Title' }).vancouver}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={handleMetadataSave} disabled={fetchingMeta} style={{ flex: 1, background: fetchingMeta ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: fetchingMeta ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: '600' }}>
                {fetchingMeta ? 'Searching...' : isNewWebSource ? 'Add Web Source' : 'Save Details'}
              </button>
              <button onClick={handleMetadataSkip} style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                {isNewWebSource ? 'Cancel' : 'Skip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CITATION POPUP */}
      {citationPopupVisible && citationPaper && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div ref={citationPopupRef} style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '520px', width: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Citation: {citationPaper.title}</h3>
              <button onClick={handleCloseCitationPopup} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#999', cursor: 'pointer' }}>×</button>
            </div>
            {!citationPaper.authors && !citationPaper.organization && (
              <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', fontSize: '0.8rem', color: '#92400e' }}>
                ⚠️ No metadata yet. Click ✏️ to add source details for a complete citation.
              </div>
            )}
            {(() => {
              const cites = generateCitations(citationPaper);
              return ['APA 7', 'Vancouver', 'MLA'].map(style => {
                const key = style === 'APA 7' ? 'apa' : style === 'Vancouver' ? 'vancouver' : 'mla';
                return (
                  <div key={style} style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>{style}</div>
                    <div style={{ fontSize: '0.8rem', background: '#f8fafc', padding: '10px', borderRadius: '6px', marginBottom: '8px', lineHeight: '1.6', color: '#1e293b' }}>{cites[key]}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => handleCopyCitation(cites[key])} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Copy</button>
                      {copiedFormat === cites[key] && <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '600' }}>✓ Copied!</span>}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* REFERENCE LIST POPUP */}
      {referencePopupVisible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div ref={referencePopupRef} style={{ background: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '640px', width: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', overflow: 'auto' }}>
            {!referenceStyle ? (
              <>
                <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Choose Citation Style</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[['APA 7', 'Alphabetical by author — used in psychology & health sciences'], ['Vancouver', 'Numbered by order of appearance — standard at KI & medical journals'], ['MLA', 'Used in humanities and literature']].map(([style, desc]) => (
                    <button key={style} onClick={() => handleSelectReferenceStyle(style === 'APA 7' ? 'apa' : style === 'Vancouver' ? 'vancouver' : 'mla')}
                      style={{ background: '#f8fafc', color: '#1e293b', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '2px' }}>{style}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{desc}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>Reference List ({referenceStyle.toUpperCase()})</h3>
                  <button onClick={handleCloseReferencePopup} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#999', cursor: 'pointer' }}>×</button>
                </div>
                <textarea value={generatedReferences} readOnly style={{ width: '100%', height: '320px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '12px', resize: 'none', boxSizing: 'border-box', lineHeight: '1.6' }} />
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button onClick={handleCopyReferences} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', flex: 1 }}>Copy All</button>
                  {referenceCopied && <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>✓ Copied!</span>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

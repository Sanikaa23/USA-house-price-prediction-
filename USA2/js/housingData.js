// housingData.js (robust, exposes refreshHousingData)
(function(){
  window.housingData = window.housingData || [];

  function parseCSVLine(line) {
    // Handles quoted fields and commas inside quotes
    const out = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' ) {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } // escaped quote
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text){
    if(!text) return [];
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if(lines.length < 1) return [];
    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    const results = [];
    for(let i=1;i<lines.length;i++){
      const parts = parseCSVLine(lines[i]);
      if(parts.length === 0) continue;
      const obj = {};
      for(let j=0;j<headers.length;j++){
        obj[headers[j]] = (parts[j] !== undefined) ? parts[j].trim() : '';
      }
      results.push(obj);
    }
    return results;
  }

  async function fetchApi(){
    try{
      const r = await fetch('/api/housing', {cache:'no-store'});
      if(!r.ok) throw new Error('API returned ' + r.status);
      const json = await r.json();
      if(Array.isArray(json) && json.length) return json;
      return null;
    }catch(e){
      console.info('No /api/housing or failed to fetch it:', e.message);
      return null;
    }
  }

  async function fetchLocalCsv(){
    try{
      const r = await fetch('/data/housing.csv', {cache:'no-store'});
      if(!r.ok) throw new Error('CSV fetch failed ' + r.status);
      const t = await r.text();
      return parseCSV(t);
    }catch(e){
      console.warn('failed to load local CSV', e.message);
      return [];
    }
  }

  async function refresh(){
    try{
      const api = await fetchApi();
      const data = (api && api.length) ? api : await fetchLocalCsv();
      window.housingData = Array.isArray(data) ? data : [];
      // normalize numeric fields where possible (makes charts easier)
      window.housingData = window.housingData.map(r => {
        const copy = Object.assign({}, r);
        ['price','latitude','longitude','lat','lon','beds','rooms','income','year'].forEach(k=>{
          if(copy[k] !== undefined && copy[k] !== null && copy[k] !== '') {
            const n = Number(String(copy[k]).replace(/[^0-9.\-]/g, ''));
            if(Number.isFinite(n)) copy[k] = n;
          }
        });
        return copy;
      });
      window.dispatchEvent(new Event('housingDataLoaded'));
      console.info('housingData loaded, records:', window.housingData.length);
      return window.housingData;
    }catch(e){
      console.error('refresh housing data failed', e);
      window.housingData = window.housingData || [];
      window.dispatchEvent(new Event('housingDataLoaded'));
      return window.housingData;
    }
  }

  window.refreshHousingData = refresh;

  if(document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(refresh, 0);
  } else {
    document.addEventListener('DOMContentLoaded', refresh, { once: true });
  }
})();
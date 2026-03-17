// dashboard-controls.js (exposes applyFilters and wires UI)
(function(){
  function $(id){ return document.getElementById(id); }

  function populateRegions(data, selectEl){
    if(!selectEl) return;
    try{
      const regions = Array.from(new Set((data||[]).map(d => (d.state || d.region || d.STATE || 'Unknown')))).filter(Boolean).sort();
      selectEl.innerHTML = '<option value="">All Regions</option>' + regions.map(r => `<option value="${r}">${r}</option>`).join('');
    }catch(e){ console.warn('populateRegions error', e); }
  }

  function readFilters(){
    const region = $('regionFilter') ? $('regionFilter').value : '';
    const priceMin = Number($('priceMin') ? $('priceMin').value : '') || 0;
    const priceMaxVal = $('priceMax') ? $('priceMax').value : '';
    const priceMax = (priceMaxVal === '') ? Number.POSITIVE_INFINITY : Number(priceMaxVal) || Number.POSITIVE_INFINITY;
    const bedsMin = Number($('bedsMin') ? $('bedsMin').value : '') || 0;
    const bedsMaxVal = $('bedsMax') ? $('bedsMax').value : '';
    const bedsMax = (bedsMaxVal === '') ? Number.POSITIVE_INFINITY : Number(bedsMaxVal) || Number.POSITIVE_INFINITY;
    return { region, priceMin, priceMax, bedsMin, bedsMax };
  }

  function applyFilters(){
    try{
      const raw = Array.isArray(window.housingData) ? window.housingData : [];
      const f = readFilters();
      const filtered = raw.filter(r => {
        const price = Number(r.price) || 0;
        const beds = Number(r.beds || r.rooms || r.num_bedrooms || 0) || 0;
        const region = r.state || r.region || '';
        if(f.region && String(region) !== String(f.region)) return false;
        if(price < f.priceMin) return false;
        if(price > f.priceMax) return false;
        if(beds < f.bedsMin) return false;
        if(beds > f.bedsMax) return false;
        return true;
      });
      if(typeof window.updateCharts === 'function') window.updateCharts(filtered);
      if(typeof window.updateMap === 'function') window.updateMap(filtered);
      const status = $('filterStatus'); if(status) status.textContent = `Showing ${filtered.length} of ${raw.length} records`;
      return filtered;
    }catch(e){
      console.error('applyFilters failed', e);
      return [];
    }
  }

  // expose globally so external buttons/utilities can call it
  window.applyFilters = applyFilters;

  function resetFilters(){
    try{
      if($('regionFilter')) $('regionFilter').value = '';
      if($('priceMin')) $('priceMin').value = '';
      if($('priceMax')) $('priceMax').value = '';
      if($('bedsMin')) $('bedsMin').value = '';
      if($('bedsMax')) $('bedsMax').value = '';
      applyFilters();
    }catch(e){ console.warn('resetFilters failed', e); }
  }

  function init(){
    try{
      const regionSelect = $('regionFilter');
      function populateNow(){
        const d = Array.isArray(window.housingData) ? window.housingData : [];
        populateRegions(d, regionSelect);
      }
      populateNow();
      // repopulate when data loads
      window.addEventListener('housingDataLoaded', populateNow);

      // wire inputs
      ['regionFilter','priceMin','priceMax','bedsMin','bedsMax'].forEach(id=>{
        const el = $(id);
        if(!el) return;
        el.addEventListener('change', applyFilters);
        // also support Enter key in numeric inputs
        el.addEventListener('keydown', (ev) => { if(ev.key === 'Enter') applyFilters(); });
      });

      const resetBtn = $('resetFilters');
      if(resetBtn) resetBtn.addEventListener('click', (e)=> { e.preventDefault(); resetFilters(); });

      // if there is an explicit apply button not wired, wire it if present
      const maybeApply = document.getElementById('applyFiltersBtn');
      if(maybeApply) maybeApply.addEventListener('click', (e)=> { e.preventDefault(); applyFilters(); });

      // initial apply to render charts/map
      setTimeout(()=>{ applyFilters(); }, 250);
    }catch(e){ console.error('dashboard-controls init failed', e); }
  }

  if(document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(init,0);
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
// dashboard-controls.js (updated: flexible fields, new filters: area, income, rooms, age, price, region)
// Removes old unwanted filters and exposes expected price after filtering.
(function(){
  function $(id){ return document.getElementById(id); }

  // field helpers - tolerate many naming conventions
  function fieldVal(obj, keys){
    for(const k of keys){
      if(obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return undefined;
  }

  function parseNumber(v){
    if(v === undefined || v === null || v === '') return NaN;
    const n = Number(String(v).replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) ? n : NaN;
  }

  // Build filter UI (if region select empty, populate from data)
  function populateRegions(data, selectEl){
    if(!selectEl) return;
    try{
      const regions = Array.from(new Set((data||[]).map(d => fieldVal(d, ['state','region','STATE','STATE_NAME']) || 'Unknown'))).filter(Boolean).sort();
      selectEl.innerHTML = '<option value="">All Regions</option>' + regions.map(r => `<option value="${r}">${r}</option>`).join('');
    }catch(e){ console.warn('populateRegions', e); }
  }

  // Read filters from DOM
  function readFilters(){
    const region = $('regionFilter') ? $('regionFilter').value : '';
    const priceMin = parseNumber($('priceMin') ? $('priceMin').value : '') || 0;
    const priceMaxVal = $('priceMax') ? $('priceMax').value : '';
    const priceMax = (priceMaxVal === '') ? Number.POSITIVE_INFINITY : (parseNumber(priceMaxVal) || Number.POSITIVE_INFINITY);

    const areaMin = parseNumber($('areaMin') ? $('areaMin').value : '') || 0;
    const areaMaxVal = $('areaMax') ? $('areaMax').value : '';
    const areaMax = (areaMaxVal === '') ? Number.POSITIVE_INFINITY : (parseNumber(areaMaxVal) || Number.POSITIVE_INFINITY);

    const incomeMin = parseNumber($('incomeMin') ? $('incomeMin').value : '') || 0;
    const incomeMaxVal = $('incomeMax') ? $('incomeMax').value : '';
    const incomeMax = (incomeMaxVal === '') ? Number.POSITIVE_INFINITY : (parseNumber(incomeMaxVal) || Number.POSITIVE_INFINITY);

    const roomsMin = parseNumber($('roomsMin') ? $('roomsMin').value : '') || 0;
    const roomsMaxVal = $('roomsMax') ? $('roomsMax').value : '';
    const roomsMax = (roomsMaxVal === '') ? Number.POSITIVE_INFINITY : (parseNumber(roomsMaxVal) || Number.POSITIVE_INFINITY);

    const ageMin = parseNumber($('ageMin') ? $('ageMin').value : '') || 0;
    const ageMaxVal = $('ageMax') ? $('ageMax').value : '';
    const ageMax = (ageMaxVal === '') ? Number.POSITIVE_INFINITY : (parseNumber(ageMaxVal) || Number.POSITIVE_INFINITY);

    return { region, priceMin, priceMax, areaMin, areaMax, incomeMin, incomeMax, roomsMin, roomsMax, ageMin, ageMax };
  }

  // compute age from common date/year fields (age in years)
  function computeAge(record){
    const year = fieldVal(record, ['year','year_built','built_year','Year']) || fieldVal(record, ['YEAR']);
    if(!year) return NaN;
    const y = parseNumber(year);
    if(!Number.isFinite(y)) return NaN;
    const now = new Date().getFullYear();
    return now - Math.round(y);
  }

  // Apply filters, update charts & map, compute expected price
  function applyFilters(){
    try{
      const raw = Array.isArray(window.housingData) ? window.housingData : [];
      const f = readFilters();

      const filtered = raw.filter(r => {
        const price = parseNumber(fieldVal(r, ['price','PRICE','price_usd'])) || 0;
        if(price < f.priceMin || price > f.priceMax) return false;

        const area = parseNumber(fieldVal(r, ['area','sqft','sq_ft','sq_ft'])) || 0;
        if(area < f.areaMin || area > f.areaMax) return false;

        const income = parseNumber(fieldVal(r, ['income','median_income','medianIncome'])) || 0;
        if(income < f.incomeMin || income > f.incomeMax) return false;

        const rooms = parseNumber(fieldVal(r, ['rooms','beds','bedrooms','beds'])) || 0;
        if(rooms < f.roomsMin || rooms > f.roomsMax) return false;

        const age = computeAge(r);
        if(!isNaN(age)){
          if(age < f.ageMin || age > f.ageMax) return false;
        } else {
          // if record has no age info, don't exclude on age (be permissive)
        }

        const region = fieldVal(r, ['state','region','STATE','STATE_NAME']) || '';
        if(f.region && String(region) !== String(f.region)) return false;

        return true;
      });

      // compute expected price
      let expectedObj = { expected: null, reason: 'no_data' };
      if(filtered.length > 0){
        // use average of filtered
        const avg = filtered.reduce((s,x) => s + (parseNumber(fieldVal(x, ['price','PRICE','price_usd'])) || 0), 0) / Math.max(1, filtered.length);
        expectedObj = { expected: Math.round(avg), reason: 'filtered_avg', count: filtered.length };
      } else {
        // fallback heuristic when no matches: use dataset averages and scale by filter inputs
        const base = raw.filter(r => parseNumber(fieldVal(r,['price','PRICE','price_usd'])));
        const avgPrice = base.reduce((s,x) => s + (parseNumber(fieldVal(x, ['price','PRICE','price_usd']))||0), 0) / Math.max(1, base.length);
        const avgIncome = base.reduce((s,x) => s + (parseNumber(fieldVal(x,['income','median_income']))||0), 0) / Math.max(1, base.length);
        const avgArea = base.reduce((s,x) => s + (parseNumber(fieldVal(x,['area','sqft','sq_ft']))||0), 0) / Math.max(1, base.length);
        const avgRooms = base.reduce((s,x) => s + (parseNumber(fieldVal(x,['rooms','beds']))||0), 0) / Math.max(1, base.length);

        // choose representative filter values (if user set min or max use avg; otherwise NaN)
        const inputIncome = (f.incomeMin && f.incomeMax && isFinite(f.incomeMin) && isFinite(f.incomeMax)) ? ((f.incomeMin + Math.min(f.incomeMax, f.incomeMin+1e9))/2) : (isFinite(f.incomeMin) ? f.incomeMin : (isFinite(f.incomeMax) ? Math.min(f.incomeMax, f.incomeMin+1e9) : NaN));
        const inputArea = (isFinite(f.areaMin) && isFinite(f.areaMax)) ? ((f.areaMin + Math.min(f.areaMax, f.areaMin+1e9))/2) : (isFinite(f.areaMin) ? f.areaMin : (isFinite(f.areaMax) ? f.areaMax : NaN));
        const inputRooms = (isFinite(f.roomsMin) && isFinite(f.roomsMax)) ? ((f.roomsMin + Math.min(f.roomsMax, f.roomsMin+1e9))/2) : (isFinite(f.roomsMin) ? f.roomsMin : (isFinite(f.roomsMax) ? f.roomsMax : NaN));

        // multipliers (guard divide-by-zero)
        const incMultiplier = (isFinite(inputIncome) && avgIncome>0) ? (inputIncome / avgIncome) : 1;
        const areaMultiplier = (isFinite(inputArea) && avgArea>0) ? (inputArea / avgArea) : 1;
        const roomsMultiplier = (isFinite(inputRooms) && avgRooms>0) ? (inputRooms / avgRooms) : 1;

        // combine with small dampening to avoid extreme output
        const combined = (incMultiplier * 0.45) + (areaMultiplier * 0.45) + (roomsMultiplier * 0.10);
        const expected = Math.round(Math.max(1000, avgPrice * Math.max(0.3, combined)));
        expectedObj = { expected, reason: 'heuristic', combined, avgPrice: Math.round(avgPrice) };
      }

      // update charts & map
      if(typeof window.updateCharts === 'function') window.updateCharts(filtered.length ? filtered : []);
      if(typeof window.updateMap === 'function') window.updateMap(filtered.length ? filtered : []);

      // update UI status
      const statusEl = $('filterStatus');
      if(statusEl){
        if(expectedObj.expected !== null){
          if(expectedObj.reason === 'filtered_avg') statusEl.textContent = `Showing ${filtered.length} record(s). Expected price (avg): $${expectedObj.expected.toLocaleString()}.`;
          else statusEl.textContent = `No exact matches. Estimated expected price: $${expectedObj.expected.toLocaleString()} (heuristic).`;
        } else {
          statusEl.textContent = `Showing ${filtered.length} record(s).`;
        }
      }

      // update map expected overlay if present
      try{
        const mapExpected = document.getElementById('mapExpected');
        if(mapExpected){
          if(expectedObj.expected !== null) mapExpected.textContent = `$${expectedObj.expected.toLocaleString()}`;
          else mapExpected.textContent = '—';
        }
      }catch(e){}

      return filtered;
    }catch(e){
      console.error('applyFilters failed', e);
      return [];
    }
  }

  // expose globally
  window.applyFilters = applyFilters;

  // reset UI inputs
  function resetFilters(){
    const ids = ['regionFilter','priceMin','priceMax','areaMin','areaMax','incomeMin','incomeMax','roomsMin','roomsMax','ageMin','ageMax'];
    ids.forEach(id => { const el = $(id); if(el) el.value = ''; });
    applyFilters();
  }
  window.resetFilters = resetFilters;

  // attach handlers
  function init(){
    try{
      // populate regions on data load
      function populateNow(){
        const sel = $('regionFilter');
        const data = Array.isArray(window.housingData) ? window.housingData : [];
        populateRegions(data, sel);
      }
      populateNow();
      window.addEventListener('housingDataLoaded', populateNow);

      // wire apply and reset buttons
      const applyBtn = $('applyFiltersBtn'); if(applyBtn) applyBtn.addEventListener('click', applyFilters);
      const resetBtn = $('resetFilters'); if(resetBtn) resetBtn.addEventListener('click', (e)=>{ e.preventDefault(); resetFilters(); });

      // auto-apply on simple field Enter
      ['priceMin','priceMax','areaMin','areaMax','incomeMin','incomeMax','roomsMin','roomsMax','ageMin','ageMax','regionFilter']
        .forEach(id => { const el = $(id); if(!el) return; el.addEventListener('keydown', (ev)=>{ if(ev.key === 'Enter') applyFilters(); }); el.addEventListener('change', ()=>{}); });

      // initial apply once page loads (small delay so housingData loader can run)
      setTimeout(()=>{ applyFilters(); }, 300);
    }catch(e){ console.error('dashboard-controls init failed', e); }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();

})();

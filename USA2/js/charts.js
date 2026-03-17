// charts.js (updated: responsive, maintainAspectRatio off for bubble chart,
// shows charts even on empty data gracefully)
(function(){
  const CHART_STORE = window._myCharts = window._myCharts || {};
  function getCanvas(id){ return document.getElementById(id); }
  function safeDestroy(key){
    try{ const c = CHART_STORE[key]; if(c && typeof c.destroy === 'function') c.destroy(); }catch(e){ console.warn('safeDestroy',e); }
    CHART_STORE[key] = null;
  }
  function numeric(v){ const n = Number(v); return Number.isFinite(n)? n : NaN; }

  function renderAll(inputData){
    const data = Array.isArray(inputData) ? inputData : (Array.isArray(window.housingData) ? window.housingData : []);
    const rows = Array.isArray(data) ? data : [];

    // common getters with flexible keys
    function getPrice(d){ return numeric(d.price ?? d.PRICE ?? d.price_usd ?? d.Price); }
    function getRegion(d){ return d.state ?? d.region ?? d.STATE ?? d.STATE_NAME ?? 'Unknown'; }
    function getIncome(d){ return numeric(d.income ?? d.median_income ?? d.medianIncome); }
    function getRooms(d){ return numeric(d.rooms ?? d.beds ?? d.bedrooms); }
    function getArea(d){ return numeric(d.area ?? d.sqft ?? d.sq_ft ?? d.living_area); }
    function getYear(d){ return numeric(d.year ?? d.year_built ?? d.built_year); }

    // PRICE BY REGION (bar)
    (function(){
      const canvas = getCanvas('priceByRegion'); if(!canvas) return;
      const sums = {}, counts = {};
      rows.forEach(r => {
        const reg = String(getRegion(r) ?? 'Unknown');
        const p = getPrice(r) || 0;
        sums[reg] = (sums[reg] || 0) + p;
        counts[reg] = (counts[reg] || 0) + 1;
      });
      const regions = Object.keys(counts).sort((a,b)=> (sums[b]/counts[b]||0) - (sums[a]/counts[a]||0)).slice(0,12);
      const avgs = regions.map(r => Math.round((sums[r]||0) / Math.max(1, counts[r]||1)));
      safeDestroy('priceByRegion');
      try{
        CHART_STORE['priceByRegion'] = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: { labels: regions, datasets: [{ label: 'Avg Price', data: avgs }] },
          options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, animation:{duration:700}, scales:{ y:{ ticks:{ callback: v => '$' + Number(v).toLocaleString() } } } }
        });
      }catch(e){ console.error('priceByRegion render', e); }
    })();

    // PRICE TREND (by year)
    (function(){
      const canvas = getCanvas('priceTrend'); if(!canvas) return;
      const byYear = {};
      rows.forEach(r => {
        let y = getYear(r) || (r.date ? new Date(r.date).getFullYear() : NaN);
        if(!Number.isFinite(y)) return;
        const p = getPrice(r) || 0;
        byYear[y] = byYear[y] || { sum:0, cnt:0 };
        byYear[y].sum += p; byYear[y].cnt++;
      });
      const years = Object.keys(byYear).map(Number).sort((a,b)=>a-b);
      const vals = years.map(y => Math.round(byYear[y].sum / Math.max(1, byYear[y].cnt)));
      safeDestroy('priceTrend');
      try{
        CHART_STORE['priceTrend'] = new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: { labels: years, datasets: [{ label:'Avg Price', data: vals, fill:true }] },
          options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, animation:{duration:800}, scales:{ y:{ ticks:{ callback: v => '$' + Number(v).toLocaleString() } } } }
        });
      }catch(e){ console.error('priceTrend render', e); }
    })();

    // PRICE vs INCOME (bubble) — fix stretch by disabling maintainAspectRatio and giving height via CSS
    (function(){
      const canvas = getCanvas('priceIncomeChart'); if(!canvas) return;
      const pts = rows.map(d => {
        const x = getIncome(d) || 0;
        const y = getPrice(d) || 0;
        const r = Math.max(4, Math.min(30, (getRooms(d) || 1) * 3));
        return { x, y, r, meta: d };
      }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
      safeDestroy('priceIncomeChart');
      try{
        CHART_STORE['priceIncomeChart'] = new Chart(canvas.getContext('2d'), {
          type:'bubble',
          data:{ datasets:[{ label:'Price vs Income', data: pts }] },
          options: {
            responsive:true,
            maintainAspectRatio:false,
            plugins: {
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const p = ctx.raw || {};
                    const m = p.meta || {};
                    const name = (m.address || m.city || m.state || '').toString();
                    return `${name} Price: $${Number(p.y).toLocaleString()} Income: $${Number(p.x).toLocaleString()}`;
                  }
                }
              }
            },
            scales: {
              x:{ title:{ display:true, text:'Income' }, ticks:{ callback: v => '$' + Number(v).toLocaleString() } },
              y:{ title:{ display:true, text:'Price ($)' }, ticks:{ callback: v => '$' + Number(v).toLocaleString() } }
            },
            animation:{ duration: 600 }
          }
        });
      }catch(e){ console.error('priceIncomeChart render', e); }
    })();

    // update small status
    try{
      const status = document.getElementById('chartStatus');
      if(status) status.textContent = `Rendered ${rows.length} records`;
    }catch(e){}
  }

  // Safe wrapper
  window.updateCharts = function(filteredData){
    try{ renderAll(Array.isArray(filteredData) ? filteredData : undefined); }catch(e){ console.error('updateCharts error', e); }
  };

  // render when data loads
  window.addEventListener('housingDataLoaded', ()=> { try{ window.updateCharts(window.housingData || []); }catch(e){ console.error(e); } });

  // initial render if data already present
  if(document.readyState !== 'loading'){
    try{ if(Array.isArray(window.housingData)) window.updateCharts(window.housingData); }catch(e){ console.error(e); }
  } else {
    document.addEventListener('DOMContentLoaded', ()=>{ try{ if(Array.isArray(window.housingData)) window.updateCharts(window.housingData); }catch(e){ console.error(e); } }, { once:true});
  }
})();

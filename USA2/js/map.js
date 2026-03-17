// map.js (updated: expected price updates on zoom/move using visible markers or zoom heuristic)
(function(){
  let map = null, markersLayer = null, overlayControl = null;

  // store last filtered data so map can use it when recomputing expected price
  window._lastFilteredData = window._lastFilteredData || null;

  function initMapIfNeeded(){
    if(map) return map;
    if(typeof L === 'undefined'){
      console.error('Leaflet (L) not found. Include leaflet.js before map.js');
      return null;
    }
    const el = document.getElementById('map');
    if(!el) return null;
    try{
      map = L.map('map', { preferCanvas: true }).setView([39.5, -98.35], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      markersLayer = L.layerGroup().addTo(map);

      overlayControl = L.control({ position: 'topright' });
      overlayControl.onAdd = function(){
        const div = L.DomUtil.create('div','map-overlay');
        div.style.padding = '8px';
        div.style.background = 'rgba(255,255,255,0.95)';
        div.style.borderRadius = '6px';
        div.style.minWidth = '160px';
        div.innerHTML = '<strong>Expected price</strong><div id="mapExpected">—</div>';
        return div;
      };
      overlayControl.addTo(map);

      // recompute expected price whenever the view changes
      map.on('zoomend moveend', ()=> {
        try{ recomputeExpectedForCurrentView(); } catch(e){ console.warn('recomputeExpectedForCurrentView failed', e); }
      });

      return map;
    }catch(e){ console.error('initMapIfNeeded', e); return null; }
  }

  function clearMarkers(){
    if(markersLayer) markersLayer.clearLayers();
  }

  // flexible numeric getter for price
  function getPrice(d){
    if(!d) return NaN;
    const v = d.price ?? d.PRICE ?? d.price_usd ?? d.Price;
    if(v === undefined || v === null || v === '') return NaN;
    const n = Number(String(v).replace(/[^0-9.\-]/g,''));
    return Number.isFinite(n) ? n : NaN;
  }

  // helper to compute average of array of numbers (ignore NaN)
  function avg(arr){
    const vals = (arr || []).filter(v => Number.isFinite(v));
    if(!vals.length) return NaN;
    return vals.reduce((s,x)=>s+x,0)/vals.length;
  }

  // recompute expected price for the current map view
  function recomputeExpectedForCurrentView(){
    const m = map;
    if(!m) return;
    // data to consider: prefer last filtered data, otherwise full housingData
    const source = Array.isArray(window._lastFilteredData) ? window._lastFilteredData : (Array.isArray(window.housingData) ? window.housingData : []);
    if(!Array.isArray(source) || source.length === 0){
      updateExpectedDisplay('—');
      return;
    }

    const bounds = m.getBounds();
    // collect prices of records that fall within current bounds
    const visiblePrices = [];
    for(const r of source){
      const lat = Number(r.latitude ?? r.lat ?? r.LAT ?? r.lat_dd ?? r.Latitude);
      const lon = Number(r.longitude ?? r.lon ?? r.LON ?? r.lon_dd ?? r.Longitude);
      if(!isFinite(lat) || !isFinite(lon)) continue;
      if(bounds.contains([lat, lon])) {
        const p = getPrice(r);
        if(Number.isFinite(p)) visiblePrices.push(p);
      }
    }

    if(visiblePrices.length > 0){
      // use average of visible prices
      const vavg = Math.round(avg(visiblePrices));
      updateExpectedDisplay(`$${vavg.toLocaleString()} (visible avg, ${visiblePrices.length})`);
      return;
    }

    // no visible houses; fallback to zoom-based heuristic using source average
    const overallPrices = source.map(r => getPrice(r)).filter(Number.isFinite);
    const globalAvg = avg(overallPrices);
    if(!Number.isFinite(globalAvg)){
      updateExpectedDisplay('—');
      return;
    }
    // zoom multiplier: each zoom level above 4 increases expectation a bit; below 4 decreases
    const z = m.getZoom ? m.getZoom() : 4;
    const factor = 1 + ((z - 4) * 0.06); // ~6% per zoom level
    const expected = Math.round(globalAvg * factor);
    updateExpectedDisplay(`$${expected.toLocaleString()} (zoom est.)`);
  }

  function updateExpectedDisplay(text){
    const el = document.getElementById('mapExpected');
    if(!el) return;
    if(typeof text === 'number') el.textContent = `$${Math.round(text).toLocaleString()}`;
    else el.textContent = text ?? '—';
  }

  // updateMap: renders markers for the provided filteredData (or full data if empty)
  function updateMap(filteredData){
    // store last filtered data for view-based expected price computation
    window._lastFilteredData = Array.isArray(filteredData) ? filteredData : (Array.isArray(window.housingData) ? window.housingData : []);
    const m = initMapIfNeeded();
    if(!m) return;
    clearMarkers();

    const data = Array.isArray(window._lastFilteredData) ? window._lastFilteredData : [];
    const boundsArr = [];
    data.forEach(d=>{
      const lat = Number(d.latitude ?? d.lat ?? d.LAT ?? d.lat_dd ?? d.Latitude);
      const lon = Number(d.longitude ?? d.lon ?? d.LON ?? d.lon_dd ?? d.Longitude);
      const price = getPrice(d) || 0;
      if(!isFinite(lat) || !isFinite(lon) || Math.abs(lat) < 1e-6 || Math.abs(lon) < 1e-6) return;
      const r = Math.max(4, Math.min(30, Math.sqrt(Math.abs(price || 1)) / 100));
      const marker = L.circleMarker([lat, lon], { radius: r, fillOpacity: 0.6, weight: 0.4 });
      const title = (d.address || d.city || d.state || d.STATE || 'Property');
      marker.bindPopup(`<strong>${title}</strong><br/>Price: $${(price).toLocaleString()}`);
      marker.addTo(markersLayer);
      boundsArr.push([lat, lon]);
    });

    if(boundsArr.length){
      try{ m.fitBounds(boundsArr, { padding:[30,30] }); }catch(e){ console.warn('fitBounds failed', e); }
    } else {
      try{ m.setView([39.5, -98.35], 4); }catch(e){}
    }

    // recompute expected for current view (this will use visible markers if any)
    try{ recomputeExpectedForCurrentView(); } catch(e){ console.warn('recompute after updateMap failed', e); }
  }

  window.initHousingMap = initMapIfNeeded;
  window.updateMap = updateMap;

  // init on DOM ready
  if(document.readyState !== 'loading') setTimeout(()=>{ if(document.getElementById('map')) initMapIfNeeded(); }, 0);
  else document.addEventListener('DOMContentLoaded', ()=>{ if(document.getElementById('map')) initMapIfNeeded(); }, { once:true });

  // when housingData changes, refresh map with current filtered data if any
  window.addEventListener('housingDataLoaded', ()=>{ try{ if(typeof window.updateMap === 'function') window.updateMap(window._lastFilteredData || window.housingData); }catch(e){console.error(e);} });

})();

/**
 * JALSETU (WDMS) - Main UI Controller and Page Renderers
 */

document.addEventListener('DOMContentLoaded', async () => {
  await initJalsetuApp();
});

async function initJalsetuApp() {
  // Load Canonical Zones Data (Priority: Flask ML backend port 5000 -> relative /api/zones -> fallback JSON)
  try {
    let res = null;
    try {
      res = await fetch('http://127.0.0.1:5000/api/zones');
    } catch (e) {
      res = await fetch('/api/zones');
    }
    if (res && res.ok) {
      window.JalsetuState.zones = await res.json();
    } else {
      // Fallback in case served statically
      const localRes = await fetch('./data/zones_data.json');
      window.JalsetuState.zones = await localRes.json();
    }
  } catch (err) {
    console.warn('Loading fallback embedded dataset', err);
    window.JalsetuState.zones = getEmbeddedZones();
  }

  // Setup Routing & Navigation
  setupNavigation();

  // Setup Profile & Authentication Handlers
  setupAuthAndProfile();

  // Render initial overview & views
  renderOverviewKpis();
  renderHomePriorityTable();
  renderDemandPredictionView();
  renderAnomalyView();
  renderShortageView();
  renderRedistributionView();
  renderMapView();
  renderProfileView();

  // Bind What-if Controls
  setupInteractiveControls();

  // Handle Initial Route
  handleRouteFromHash();
}

/**
 * Handle Single-Page Navigation
 */
function setupNavigation() {
  const navLinks = document.querySelectorAll('[data-route]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetRoute = link.getAttribute('data-route');
      navigateTo(targetRoute);
    });
  });

  window.addEventListener('hashchange', handleRouteFromHash);
}

function handleRouteFromHash() {
  const hash = window.location.hash.replace('#', '') || 'home';
  navigateTo(hash, false);
}

function navigateTo(routeId, updateHash = true) {
  const validViews = ['home', 'prediction', 'analysis', 'anomalies', 'shortages', 'redistribution', 'map', 'about', 'profile', 'import'];
  const target = validViews.includes(routeId) ? routeId : 'home';

  // Map sub-routes under analysis if clicked
  const activeViewId = (target === 'analysis') ? 'anomalies' : target;

  // Update views
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.remove('active');
  });

  const activeElement = document.getElementById(`view-${activeViewId}`);
  if (activeElement) {
    activeElement.classList.add('active');
  }

  // Update nav active classes
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    const linkRoute = link.getAttribute('data-route');
    if (linkRoute === target || (target.match(/anomalies|shortages|redistribution/) && linkRoute === 'analysis')) {
      link.classList.add('active');
    }
  });

  if (updateHash) {
    window.location.hash = target;
  }

  window.JalsetuState.activeView = activeViewId;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Refresh view specific components like Leaflet maps or charts
  if (activeViewId === 'map') {
    setTimeout(initOrInvalidateMap, 200);
  }
}

/**
 * Render Overview KPIs on Home
 */
function renderOverviewKpis() {
  const zones = window.JalsetuState.zones;
  const totalDemand = zones.reduce((sum, z) => sum + z.predictedDemand, 0);
  const totalCurrentSupply = zones.reduce((sum, z) => sum + z.availableSupply, 0);
  const totalShortage = zones.reduce((sum, z) => sum + JalsetuLogic.calculateShortage(z.predictedDemand, z.availableSupply), 0);

  const demandEl = document.getElementById('kpi-total-demand');
  const supplyEl = document.getElementById('kpi-available-supply');
  const shortageEl = document.getElementById('kpi-estimated-shortage');
  const zonesCountEl = document.getElementById('kpi-zones-count');

  if (demandEl) demandEl.innerHTML = `${JalsetuLogic.formatNumber(totalDemand)} <span class="unit">L</span>`;
  if (supplyEl) supplyEl.innerHTML = `${JalsetuLogic.formatNumber(totalCurrentSupply)} <span class="unit">L</span>`;
  if (shortageEl) shortageEl.innerHTML = `${JalsetuLogic.formatNumber(totalShortage)} <span class="unit">L</span>`;
  if (zonesCountEl) zonesCountEl.textContent = zones.length;
}

/**
 * Render Home Page Priority Zones Table
 */
function renderHomePriorityTable() {
  const tableBody = document.querySelector('#home-priority-table tbody');
  if (!tableBody) return;

  const zones = window.JalsetuState.zones;
  tableBody.innerHTML = '';

  zones.forEach(zone => {
    const shortage = JalsetuLogic.calculateShortage(zone.predictedDemand, zone.availableSupply);
    const risk = JalsetuLogic.classifyRisk(zone.predictedDemand, zone.availableSupply);
    const pillClass = risk === 'High' ? 'danger' : (risk === 'Medium' ? 'warning' : 'success');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${zone.name}</strong> <span style="color:var(--color-text-secondary); font-size:12px;">(${zone.displayName.split('(')[1] || ''}</span></td>
      <td class="text-right">${JalsetuLogic.formatNumber(zone.predictedDemand)} L</td>
      <td class="text-right">${JalsetuLogic.formatNumber(zone.availableSupply)} L</td>
      <td class="text-right ${shortage > 0 ? 'text-danger' : ''}" style="${shortage > 0 ? 'color:var(--color-value-negative); font-weight:600;' : ''}">
        ${JalsetuLogic.formatNumber(shortage)} L
      </td>
      <td class="text-center">
        <span class="status-pill ${pillClass}">${risk} Risk</span>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/**
 * Render Demand Prediction Page
 */
function renderDemandPredictionView() {
  const tableBody = document.querySelector('#demand-prediction-table tbody');
  if (!tableBody) return;

  const zones = window.JalsetuState.zones;
  tableBody.innerHTML = '';

  zones.forEach(zone => {
    const trendClass = zone.trend.toLowerCase();
    const trendIcon = zone.trend === 'Increase' ? '↑' : (zone.trend === 'Decrease' ? '↓' : '—');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${zone.name}</strong></td>
      <td class="text-right">${JalsetuLogic.formatNumber(zone.predictedDemand / 1000)}</td>
      <td class="text-center">
        <span class="trend-indicator ${trendClass}">
          ${trendIcon} ${zone.trend}
        </span>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  renderPredictionChart();
}

function renderPredictionChart() {
  const ctx = document.getElementById('demandPredictionChart');
  if (!ctx) return;

  const hours = ['12 AM', '3 AM', '6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM'];
  
  // Synthetic hourly profiles matching the mockup shapes
  const datasets = [
    {
      label: 'Zone A',
      borderColor: '#1F6FDB',
      backgroundColor: 'transparent',
      data: [350, 420, 680, 850, 620, 580, 780, 610, 400],
      tension: 0.4
    },
    {
      label: 'Zone B',
      borderColor: '#1C8748',
      backgroundColor: 'transparent',
      data: [400, 480, 720, 1100, 890, 800, 1250, 950, 520],
      tension: 0.4
    },
    {
      label: 'Zone C',
      borderColor: '#C96100',
      backgroundColor: 'transparent',
      data: [300, 310, 500, 620, 540, 490, 580, 480, 320],
      tension: 0.4
    },
    {
      label: 'Zone D',
      borderColor: '#7B5CD6',
      backgroundColor: 'transparent',
      data: [450, 500, 790, 950, 820, 790, 1050, 880, 500],
      tension: 0.4
    },
    {
      label: 'Zone E',
      borderColor: '#D9363E',
      backgroundColor: 'transparent',
      data: [320, 360, 550, 710, 640, 590, 750, 600, 370],
      tension: 0.4
    }
  ];

  if (window.JalsetuState.chartInstances.demandChart) {
    window.JalsetuState.chartInstances.demandChart.destroy();
  }

  window.JalsetuState.chartInstances.demandChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hours,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { boxWidth: 12, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} L/h`
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Water Demand (Litres / hr)' },
          grid: { color: '#EAF0F6' }
        },
        x: {
          grid: { color: '#EAF0F6' }
        }
      }
    }
  });
}

/**
 * Render Abnormal Consumption View
 */
function renderAnomalyView() {
  const tableBody = document.querySelector('#anomaly-table tbody');
  if (!tableBody) return;

  const zones = window.JalsetuState.zones;
  tableBody.innerHTML = '';

  zones.forEach(zone => {
    let pillClass = 'normal';
    let statusText = 'Normal';

    if (zone.anomaly.severity === 'High Alert') {
      pillClass = 'high-alert';
      statusText = 'High Alert';
    } else if (zone.anomaly.severity === 'High') {
      pillClass = 'warning';
      statusText = 'High';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${zone.name}</strong></td>
      <td class="text-right"><strong>${zone.currentConsumption}</strong> L</td>
      <td class="text-right" style="color:var(--color-text-secondary);">${zone.normalRange[0]} – ${zone.normalRange[1]}</td>
      <td class="text-center">
        <span class="status-pill ${pillClass}">${statusText}</span>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/**
 * Render Shortage Prediction View
 */
function renderShortageView() {
  const tableBody = document.querySelector('#shortage-prediction-table tbody');
  if (!tableBody) return;

  const zones = window.JalsetuState.zones;
  tableBody.innerHTML = '';

  let totalShortage = 0;

  zones.forEach(zone => {
    const shortage = JalsetuLogic.calculateShortage(zone.predictedDemand, zone.availableSupply);
    totalShortage += shortage;
    const isShortage = shortage > 0;
    const isSlight = shortage > 0 && (shortage / zone.predictedDemand) < 0.10;

    let pillClass = 'adequate';
    let pillText = 'Adequate';
    if (isSlight) {
      pillClass = 'slight';
      pillText = 'Slight';
    } else if (isShortage) {
      pillClass = 'shortage';
      pillText = 'Shortage';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${zone.name}</strong></td>
      <td class="text-right">${JalsetuLogic.formatNumber(zone.predictedDemand)}</td>
      <td class="text-right">${JalsetuLogic.formatNumber(zone.availableSupply)}</td>
      <td class="text-right ${shortage > 0 ? 'text-danger' : ''}" style="${shortage > 0 ? 'color:var(--color-value-negative); font-weight:700;' : ''}">
        ${shortage > 0 ? JalsetuLogic.formatNumber(shortage) : '0'}
      </td>
      <td class="text-center">
        <span class="status-pill ${pillClass}">${pillText}</span>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  const bannerText = document.getElementById('shortage-banner-total');
  if (bannerText) {
    bannerText.textContent = `Total Estimated Shortage: ${JalsetuLogic.formatNumber(totalShortage)} L`;
  }
}

/**
 * Render Redistribution Plan View & What-if Interactive Slider
 */
function renderRedistributionView() {
  const supplySlider = document.getElementById('redistribution-supply-slider');
  const supplyDisplay = document.getElementById('redistribution-supply-value');
  const tableBody = document.querySelector('#redistribution-plan-table tbody');

  if (!tableBody) return;

  const supplyVal = parseInt(supplySlider ? supplySlider.value : window.JalsetuState.totalAvailableSupply, 10);
  if (supplyDisplay) supplyDisplay.textContent = `${JalsetuLogic.formatNumber(supplyVal)} L`;

  const allocationResult = JalsetuLogic.redistributeSupply(window.JalsetuState.zones, supplyVal);

  tableBody.innerHTML = '';
  allocationResult.forEach(zone => {
    const transferSign = zone.netTransfer > 0 ? `+${JalsetuLogic.formatNumber(zone.netTransfer)}` : (zone.netTransfer < 0 ? JalsetuLogic.formatNumber(zone.netTransfer) : '+0');
    const transferStyle = zone.netTransfer > 0 ? 'color:var(--color-value-positive); font-weight:600;' : (zone.netTransfer < 0 ? 'color:var(--color-value-negative);' : 'color:var(--color-text-secondary);');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${zone.name}</strong></td>
      <td class="text-right">${JalsetuLogic.formatNumber(zone.availableSupply)}</td>
      <td class="text-right" style="${transferStyle}">${transferSign}</td>
      <td class="text-right"><strong>${JalsetuLogic.formatNumber(zone.recommendedAllocation)}</strong></td>
      <td class="text-right ${zone.remainingShortage > 0 ? 'text-danger' : ''}" style="${zone.remainingShortage > 0 ? 'color:var(--color-value-negative); font-weight:600;' : ''}">
        ${zone.remainingShortage > 0 ? JalsetuLogic.formatNumber(zone.remainingShortage) : '0'}
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/**
 * Leaflet Interactive Map View
 */
let mapInstance = null;
function initOrInvalidateMap() {
  const container = document.getElementById('map-container');
  if (!container) return;

  if (!mapInstance) {
    // Centered around Thane/Mumbai smart city coordinates
    mapInstance = L.map('map-container').setView([19.2000, 72.9750], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(mapInstance);

    // Add Zone Markers
    window.JalsetuState.zones.forEach(zone => {
      const risk = JalsetuLogic.classifyRisk(zone.predictedDemand, zone.availableSupply);
      const colorMap = { 'High': '#D9363E', 'Medium': '#FFA94D', 'Low': '#40C057' };
      const color = colorMap[risk] || '#40C057';

      const circle = L.circleMarker(zone.coordinates, {
        radius: 12,
        fillColor: color,
        color: '#FFFFFF',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85
      }).addTo(mapInstance);

      circle.bindPopup(`
        <div style="font-family:sans-serif; min-width:180px;">
          <h4 style="margin:0 0 4px 0; color:#0B1F3A;">${zone.name}</h4>
          <p style="margin:0 0 6px 0; font-size:12px; color:#5A6B8B;">${zone.displayName}</p>
          <div style="font-size:13px; line-height:1.4;">
            <div><strong>Predicted Demand:</strong> ${JalsetuLogic.formatNumber(zone.predictedDemand)} L</div>
            <div><strong>Available Supply:</strong> ${JalsetuLogic.formatNumber(zone.availableSupply)} L</div>
            <div><strong>Risk Level:</strong> <span style="color:${color}; font-weight:700;">${risk}</span></div>
          </div>
        </div>
      `);
    });
  } else {
    mapInstance.invalidateSize();
  }

  renderConsumptionTrendChart();
}

function renderConsumptionTrendChart() {
  const ctx = document.getElementById('zoneConsumptionTrendChart');
  if (!ctx) return;

  if (window.JalsetuState.chartInstances.zoneTrendChart) {
    window.JalsetuState.chartInstances.zoneTrendChart.destroy();
  }

  const days = ['Oct 10', 'Oct 11', 'Oct 12', 'Oct 13', 'Oct 14'];
  const actualValues = [780, 810, 830, 850, 880];
  const predictedValues = [770, 800, 840, 890, 920];

  window.JalsetuState.chartInstances.zoneTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Actual',
          data: actualValues,
          borderColor: '#1F6FDB',
          backgroundColor: 'transparent',
          tension: 0.3
        },
        {
          label: 'Predicted',
          data: predictedValues,
          borderColor: '#D9363E',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', align: 'end' }
      },
      scales: {
        y: {
          title: { display: true, text: 'Litres' },
          grid: { color: '#EAF0F6' }
        },
        x: {
          grid: { color: '#EAF0F6' }
        }
      }
    }
  });
}

/**
 * Setup Event Listeners & Interactive Controls
 */
function setupInteractiveControls() {
  const supplySlider = document.getElementById('redistribution-supply-slider');
  if (supplySlider) {
    supplySlider.addEventListener('input', () => {
      renderRedistributionView();
    });
  }

  // Quick access cards navigation
  document.querySelectorAll('.quick-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const target = card.getAttribute('data-target');
      if (target) {
        navigateTo(target);
      }
    });
  });

  // CSV Export action
  const exportBtn = document.getElementById('export-redistribution-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportRedistributionCsv);
  }
}

function exportRedistributionCsv() {
  const supplySlider = document.getElementById('redistribution-supply-slider');
  const supplyVal = parseInt(supplySlider ? supplySlider.value : 1620000, 10);
  const data = JalsetuLogic.redistributeSupply(window.JalsetuState.zones, supplyVal);

  let csv = 'Zone,Initial Supply (L),Predicted Demand (L),Net Transfer (L),Recommended Allocation (L),Remaining Shortage (L)\n';
  data.forEach(z => {
    csv += `"${z.name}",${z.availableSupply},${z.predictedDemand},${z.netTransfer},${z.recommendedAllocation},${z.remainingShortage}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `jalsetu_water_redistribution_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * User Profile & Authentication Controllers
 */
function setupAuthAndProfile() {
  const navUserBtn = document.getElementById('nav-user-btn');
  const loginModal = document.getElementById('login-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const switchAccountBtn = document.getElementById('btn-switch-account');
  const loginForm = document.getElementById('login-form');
  const tabOperator = document.getElementById('tab-operator');
  const tabAnalyst = document.getElementById('tab-analyst');
  const emailInput = document.getElementById('login-email');

  if (navUserBtn) {
    navUserBtn.addEventListener('click', () => {
      navigateTo('profile');
    });
  }

  if (switchAccountBtn) {
    switchAccountBtn.addEventListener('click', () => {
      openLoginModal();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeLoginModal();
    });
  }

  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeLoginModal();
    });
  }

  // Preset Role Switcher
  if (tabOperator && tabAnalyst && emailInput) {
    tabOperator.addEventListener('click', () => {
      tabOperator.classList.add('active');
      tabAnalyst.classList.remove('active');
      emailInput.value = window.JalsetuState.roles.operator.email;
    });

    tabAnalyst.addEventListener('click', () => {
      tabAnalyst.classList.add('active');
      tabOperator.classList.remove('active');
      emailInput.value = window.JalsetuState.roles.analyst.email;
    });
  }

  // Handle Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const isAnalyst = tabAnalyst && tabAnalyst.classList.contains('active');
      const selectedRole = isAnalyst ? window.JalsetuState.roles.analyst : window.JalsetuState.roles.operator;
      
      window.JalsetuState.currentUser = {
        ...selectedRole,
        lastLogin: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST'
      };

      closeLoginModal();
      renderProfileView();
      navigateTo('home');
    });
  }
}

function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('active');
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('active');
}

function renderProfileView() {
  const u = window.JalsetuState.currentUser;
  if (!u) return;

  // Update Navbar initials
  const initialsEl = document.getElementById('nav-user-initials');
  if (initialsEl) initialsEl.textContent = u.avatarInitials;

  // Update Profile Page Fields
  const avatarEl = document.getElementById('profile-card-avatar');
  const nameEl = document.getElementById('profile-card-name');
  const roleEl = document.getElementById('profile-card-role');
  const idEl = document.getElementById('profile-card-id');
  const emailEl = document.getElementById('profile-card-email');
  const deptEl = document.getElementById('profile-card-dept');
  const jurEl = document.getElementById('profile-card-jurisdiction');
  const accessEl = document.getElementById('profile-card-access');
  const loginEl = document.getElementById('profile-card-login');

  if (avatarEl) avatarEl.textContent = u.avatarInitials;
  if (nameEl) nameEl.textContent = u.name;
  if (roleEl) roleEl.textContent = u.role;
  if (idEl) idEl.textContent = u.id;
  if (emailEl) emailEl.textContent = u.email;
  if (deptEl) deptEl.textContent = u.department;
  if (jurEl) jurEl.textContent = u.jurisdiction;
  if (accessEl) accessEl.textContent = u.accessLevel;
  if (loginEl) loginEl.textContent = u.lastLogin;
}

// Fallback Embedded Dataset
function getEmbeddedZones() {
  return [
    { id: 'zone-a', name: 'Zone A', displayName: 'Zone A (North District)', coordinates: [19.2183, 72.9781], currentConsumption: 510, normalRange: [450, 550], predictedDemand: 520000, availableSupply: 600000, trend: 'Increase', anomaly: { detected: false, severity: 'Normal', type: 'None', deviationPct: 2.0 } },
    { id: 'zone-b', name: 'Zone B', displayName: 'Zone B (Central Commercial)', coordinates: [19.1995, 72.9644], currentConsumption: 850, normalRange: [400, 600], predictedDemand: 760000, availableSupply: 500000, trend: 'Increase', anomaly: { detected: true, severity: 'High Alert', type: 'Sudden Demand Surge', deviationPct: 42.0 } },
    { id: 'zone-c', name: 'Zone C', displayName: 'Zone C (West Suburbs)', coordinates: [19.1852, 72.9512], currentConsumption: 590, normalRange: [500, 650], predictedDemand: 430000, availableSupply: 300000, trend: 'Stable', anomaly: { detected: false, severity: 'Normal', type: 'None', deviationPct: -1.2 } },
    { id: 'zone-d', name: 'Zone D', displayName: 'Zone D (Industrial Belt)', coordinates: [19.2050, 72.9902], currentConsumption: 720, normalRange: [600, 700], predictedDemand: 690000, availableSupply: 550000, trend: 'Increase', anomaly: { detected: true, severity: 'High', type: 'Sustained Elevation', deviationPct: 18.5 } },
    { id: 'zone-e', name: 'Zone E', displayName: 'Zone E (South Residential)', coordinates: [19.1724, 72.9730], currentConsumption: 480, normalRange: [450, 600], predictedDemand: 580000, availableSupply: 400000, trend: 'Decrease', anomaly: { detected: false, severity: 'Normal', type: 'None', deviationPct: -3.5 } }
  ];
}

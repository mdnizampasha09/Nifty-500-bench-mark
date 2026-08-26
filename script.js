let globalData = null;
let currentMode = "daily";
let currentTail = 5;
let currentBgTheme = "cleanLight";
let selectedSectors = new Set();

// Background Color Mapping for Plotly Chart Elements
const BG_THEME_PALETTES = {
  // Pure / Crisp Light
  cleanLight: { paper: '#ffffff', plot: '#f8fafc', grid: '#e2e8f0', font: '#1e293b' },

  // Warm Paper / Sand
  warmPaper: { paper: '#fbf9f5', plot: '#f3efe6', grid: '#e5dec9', font: '#4a3e3d' },

  // Cool Slate / Ice Blue
  iceBlue: { paper: '#f4f7fb', plot: '#e9f0f8', grid: '#d1e0f0', font: '#1e3a5f' },

  // Mint / Sage Mist
  softMint: { paper: '#f4f9f6', plot: '#e8f3ec', grid: '#cde4d5', font: '#234e38' },

  // Lavender / Soft Purple
  lavender: { paper: '#faf7fd', plot: '#f1ebfa', grid: '#ded2f5', font: '#3b2d54' },

  // Rose / Blush
  softRose: { paper: '#fff7f8', plot: '#faebed', grid: '#f3d2d7', font: '#5c2d36' },

  // Solarized Light
  solarizedLight: { paper: '#fdf6e3', plot: '#eee8d5', grid: '#dcd3b8', font: '#657b83' }
};

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    fetchDataAndRender();
});

function setupEventListeners() {
    document.querySelectorAll(".toggle-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            currentMode = e.target.getAttribute("data-timeframe");
            updateDashboard();
        });
    });

    document.getElementById("tail-select").addEventListener("change", (e) => {
        currentTail = parseInt(e.target.value, 10);
        updateDashboard();
    });

    // Screen Background Changer
    document.getElementById("bg-theme-select").addEventListener("change", (e) => {
        currentBgTheme = e.target.value;
        document.body.className = `theme-${currentBgTheme}`;
        renderActiveChart();
    });

    ["improving", "leading", "weakening", "lagging"].forEach(quad => {
        const masterCb = document.getElementById(`master-${quad}`);
        if (masterCb) {
            masterCb.addEventListener("change", (e) => {
                const list = document.getElementById(`list-${quad}`);
                if (list) {
                    list.querySelectorAll("input[type='checkbox']").forEach(cb => {
                        cb.checked = e.target.checked;
                        if (e.target.checked) selectedSectors.add(cb.value);
                        else selectedSectors.delete(cb.value);
                    });
                }
                renderActiveChart();
            });
        }
    });
}

function getActiveDataset() {
    if (!globalData) return [];
    return (currentMode === "weekly" && globalData.weekly) ? globalData.weekly : (globalData.daily || globalData.data || []);
}

async function fetchDataAndRender() {
    try {
        const response = await fetch("data.json?t=" + new Date().getTime());
        if (!response.ok) throw new Error("Could not load data.json");
        globalData = await response.json();

        const timestampEl = document.getElementById("last-updated");
        if (timestampEl && globalData.last_updated) {
            timestampEl.textContent = `Last Scraped: ${globalData.last_updated}`;
        }

        const dataset = getActiveDataset();
        dataset.forEach(s => selectedSectors.add(s.sector));

        updateDashboard();
    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

function updateDashboard() {
    const allSectors = getActiveDataset();
    populateQuadrantsWithCheckboxes(allSectors);
    renderActiveChart();
}

function populateQuadrantsWithCheckboxes(sectors) {
    const categories = {
        Improving: { list: document.getElementById("list-improving"), badge: document.getElementById("badge-improving"), count: 0 },
        Leading: { list: document.getElementById("list-leading"), badge: document.getElementById("badge-leading"), count: 0 },
        Weakening: { list: document.getElementById("list-weakening"), badge: document.getElementById("badge-weakening"), count: 0 },
        Lagging: { list: document.getElementById("list-lagging"), badge: document.getElementById("badge-lagging"), count: 0 }
    };

    Object.values(categories).forEach(c => { if (c.list) c.list.innerHTML = ""; });

    sectors.forEach(sec => {
        const target = categories[sec.quadrant];
        if (target && target.list) {
            target.count++;
            const isChecked = selectedSectors.has(sec.sector);
            const label = document.createElement("label");
            label.className = "sector-checkbox-item";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = sec.sector;
            cb.checked = isChecked;

            cb.addEventListener("change", (e) => {
                if (e.target.checked) selectedSectors.add(sec.sector);
                else selectedSectors.delete(sec.sector);
                renderActiveChart();
            });

            label.appendChild(cb);
            label.insertAdjacentHTML("beforeend", `<span class="sector-dot"></span><span>${sec.sector}</span>`);
            target.list.appendChild(label);
        }
    });

    Object.values(categories).forEach(c => {
        if (c.badge) c.badge.textContent = c.count;
    });
}

function renderActiveChart() {
    const allSectors = getActiveDataset();
    const activeSectors = allSectors.filter(s => selectedSectors.has(s.sector));
    renderPlotlyRRG(activeSectors);
}

function renderPlotlyRRG(sectors) {
    const theme = BG_THEME_PALETTES[currentBgTheme] || BG_THEME_PALETTES.midnight;
    const defaultColors = ["#00f0ff", "#39ff14", "#ff007f", "#ffe600", "#b026ff", "#ff5e00", "#00ffa3", "#ff003c", "#7000ff", "#00b8ff", "#ff80df", "#9dff00", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];
    
    const traces = [];
    let allX = [100];
    let allY = [100];

    sectors.forEach((sec, idx) => {
        const fullTrail = sec.trail || [{ x: sec.x, y: sec.y }];
        const trailSlice = fullTrail.slice(-currentTail);
        const sectorColor = defaultColors[idx % defaultColors.length];
        
        const xPts = trailSlice.map(p => p.x);
        const yPts = trailSlice.map(p => p.y);
        allX.push(...xPts);
        allY.push(...yPts);

        const markerSizes = trailSlice.map((_, i) => (i === trailSlice.length - 1 ? 12 : 5));

        traces.push({
            x: xPts,
            y: yPts,
            mode: 'lines+markers+text',
            name: sec.sector,
            text: trailSlice.map((_, i) => (i === trailSlice.length - 1 ? ` <b>${sec.sector}</b>` : '')),
            textposition: 'top right',
            textfont: { size: 12, color: theme.font },
            line: { shape: 'spline', smoothing: 1.2, width: 2.5, color: sectorColor },
            marker: { size: markerSizes, color: sectorColor }
        });
    });

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    const padX = Math.max((maxX - minX) * 0.15, 0.8);
    const padY = Math.max((maxY - minY) * 0.15, 0.8);

    const xRange = [minX - padX, maxX + padX];
    const yRange = [minY - padY, maxY + padY];

    const layout = {
        title: {
            text: `NSE SECTOR ROTATION vs NIFTY 500 (${currentMode.toUpperCase()} - ${currentTail} PERIODS)`,
            font: { size: 16, color: '#38bdf8' }
        },
        paper_bgcolor: theme.paper,
        plot_bgcolor: theme.plot,
        dragmode: 'pan',
        showlegend: false,
        margin: { l: 60, r: 40, t: 50, b: 40 },
        xaxis: {
            title: { text: 'JdK RS-Ratio (Relative Strength)', font: { color: theme.font, size: 13 } },
            gridcolor: theme.grid,
            range: xRange,
            zeroline: false,
            tickfont: { color: theme.font }
        },
        yaxis: {
            title: { text: 'JdK RS-Momentum (Momentum)', font: { color: theme.font, size: 13 } },
            gridcolor: theme.grid,
            range: yRange,
            zeroline: false,
            tickfont: { color: theme.font }
        },
        shapes: [
            { type: 'rect', xref: 'x', yref: 'y', x0: 100, y0: 100, x1: 200, y1: 200, fillcolor: 'rgba(34, 197, 94, 0.10)', line: { width: 0 }, layer: 'below' },
            { type: 'rect', xref: 'x', yref: 'y', x0: 100, y0: 0, x1: 200, y1: 100, fillcolor: 'rgba(245, 158, 11, 0.10)', line: { width: 0 }, layer: 'below' },
            { type: 'rect', xref: 'x', yref: 'y', x0: 0, y0: 0, x1: 100, y1: 100, fillcolor: 'rgba(239, 68, 68, 0.10)', line: { width: 0 }, layer: 'below' },
            { type: 'rect', xref: 'x', yref: 'y', x0: 0, y0: 100, x1: 100, y1: 200, fillcolor: 'rgba(59, 130, 246, 0.10)', line: { width: 0 }, layer: 'below' },
            { type: 'line', xref: 'x', yref: 'paper', x0: 100, y0: 0, x1: 100, y1: 1, line: { color: '#38bdf8', width: 2, dash: 'dash' } },
            { type: 'line', xref: 'paper', yref: 'y', x0: 0, y0: 100, x1: 1, y1: 100, line: { color: '#38bdf8', width: 2, dash: 'dash' } }
        ],
        annotations: [
            { xref: 'paper', yref: 'paper', x: 0.98, y: 0.98, text: 'LEADING', showarrow: false, font: { color: 'rgba(34, 197, 94, 0.5)', size: 16, weight: 'bold' }, xanchor: 'right' },
            { xref: 'paper', yref: 'paper', x: 0.98, y: 0.02, text: 'WEAKENING', showarrow: false, font: { color: 'rgba(245, 158, 11, 0.5)', size: 16, weight: 'bold' }, xanchor: 'right' },
            { xref: 'paper', yref: 'paper', x: 0.02, y: 0.02, text: 'LAGGING', showarrow: false, font: { color: 'rgba(239, 68, 68, 0.5)', size: 16, weight: 'bold' }, xanchor: 'left' },
            { xref: 'paper', yref: 'paper', x: 0.02, y: 0.98, text: 'IMPROVING', showarrow: false, font: { color: 'rgba(59, 130, 246, 0.5)', size: 16, weight: 'bold' }, xanchor: 'left' }
        ]
    };

    const config = {
        responsive: true,
        scrollZoom: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['select2d', 'lasso2d']
    };

    Plotly.react('rrgPlotly', traces, layout, config);
}

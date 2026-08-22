let globalData = null;
let currentMode = "daily";
let currentTail = 5;
let selectedSectors = new Set();

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    fetchDataAndRender();
});

function setupEventListeners() {
    // Timeframe toggle
    document.querySelectorAll(".toggle-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            currentMode = e.target.getAttribute("data-timeframe");
            updateDashboard();
        });
    });

    // Tail length selection
    document.getElementById("tail-select").addEventListener("change", (e) => {
        currentTail = parseInt(e.target.value, 10);
        updateDashboard();
    });

    // Bulk Select / Deselect
    document.getElementById("btn-select-all").addEventListener("click", () => {
        const dataset = getActiveDataset();
        dataset.forEach(s => selectedSectors.add(s.sector));
        renderCheckboxes(dataset);
        updateDashboard();
    });

    document.getElementById("btn-deselect-all").addEventListener("click", () => {
        selectedSectors.clear();
        renderCheckboxes(getActiveDataset());
        updateDashboard();
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

        // Initialize all sectors as selected
        const dataset = getActiveDataset();
        dataset.forEach(s => selectedSectors.add(s.sector));
        renderCheckboxes(dataset);

        updateDashboard();
    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

function renderCheckboxes(sectors) {
    const container = document.getElementById("sector-checkbox-container");
    if (!container) return;
    container.innerHTML = "";

    sectors.forEach(sec => {
        const label = document.createElement("label");
        const isChecked = selectedSectors.has(sec.sector);
        label.className = `sector-checkbox-label ${isChecked ? 'checked' : ''}`;
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isChecked;
        checkbox.value = sec.sector;

        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                selectedSectors.add(sec.sector);
                label.classList.add("checked");
            } else {
                selectedSectors.delete(sec.sector);
                label.classList.remove("checked");
            }
            updateDashboard();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(sec.sector));
        container.appendChild(label);
    });
}

function updateDashboard() {
    const allSectors = getActiveDataset();
    populateQuadrants(allSectors);
    
    // Filter active sectors for chart rendering
    const activeSectors = allSectors.filter(s => selectedSectors.has(s.sector));
    renderPlotlyRRG(activeSectors);
}

function populateQuadrants(sectors) {
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
            const li = document.createElement("li");
            li.className = "sector-item";
            li.innerHTML = `<span class="sector-dot"></span><span>${sec.sector}</span>`;
            target.list.appendChild(li);
        }
    });

    Object.values(categories).forEach(c => {
        if (c.badge) c.badge.textContent = c.count;
    });
}

function renderPlotlyRRG(sectors) {
    const traces = [];
    let allX = [100];
    let allY = [100];

    sectors.forEach(sec => {
        const fullTrail = sec.trail || [{ x: sec.x, y: sec.y }];
        const trailSlice = fullTrail.slice(-currentTail);
        
        const xPts = trailSlice.map(p => p.x);
        const yPts = trailSlice.map(p => p.y);
        allX.push(...xPts);
        allY.push(...yPts);

        const markerSizes = trailSlice.map((_, idx) => (idx === trailSlice.length - 1 ? 12 : 5));

        traces.push({
            x: xPts,
            y: yPts,
            mode: 'lines+markers+text',
            name: sec.sector,
            text: trailSlice.map((_, idx) => (idx === trailSlice.length - 1 ? ` <b>${sec.sector}</b>` : '')),
            textposition: 'top right',
            textfont: { size: 12, color: '#f8fafc' },
            line: { shape: 'spline', smoothing: 1.2, width: 2.5 },
            marker: { size: markerSizes }
        });
    });

    // Dynamic auto-zoom calculation around origin (100, 100) and visible data
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
        paper_bgcolor: '#131d31',
        plot_bgcolor: '#0b1120',
        dragmode: 'pan',
        showlegend: false, // Legend removed from beneath the chart
        margin: { l: 60, r: 40, t: 50, b: 40 },
        xaxis: {
            title: { text: 'JdK RS-Ratio (Relative Strength)', font: { color: '#94a3b8', size: 13 } },
            gridcolor: '#1e293b',
            range: xRange,
            zeroline: false,
            tickfont: { color: '#94a3b8' }
        },
        yaxis: {
            title: { text: 'JdK RS-Momentum (Momentum)', font: { color: '#94a3b8', size: 13 } },
            gridcolor: '#1e293b',
            range: yRange,
            zeroline: false,
            tickfont: { color: '#94a3b8' }
        },
        shapes: [
            // Dynamic Zoomed Colored Quadrant Zones
            { type: 'rect', xref: 'x', yref: 'y', x0: 100, y0: 100, x1: 200, y1: 200, fillcolor: 'rgba(34, 197, 94, 0.10)', line: { width: 0 }, layer: 'below' },
            { type: 'rect', xref: 'x', yref: 'y', x0: 100, y0: 0, x1: 200, y1: 100, fillcolor: 'rgba(245, 158, 11, 0.10)', line: { width: 0 }, layer: 'below' },
            { type: 'rect', xref: 'x', yref: 'y', x0: 0, y0: 0, x1: 100, y1: 100, fillcolor: 'rgba(239, 68, 68, 0.10)', line: { width: 0 }, layer: 'below' },
            { type: 'rect', xref: 'x', yref: 'y', x0: 0, y0: 100, x1: 100, y1: 200, fillcolor: 'rgba(59, 130, 246, 0.10)', line: { width: 0 }, layer: 'below' },
            // Centered Reference Crosshairs
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

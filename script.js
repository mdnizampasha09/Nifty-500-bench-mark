let globalData = null;
let currentMode = "daily";
let currentTail = 5;

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

        updateDashboard();
    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

function updateDashboard() {
    if (!globalData) return;
    const dataset = (currentMode === "weekly" && globalData.weekly) ? globalData.weekly : (globalData.daily || globalData.data || []);
    
    populateQuadrants(dataset);
    renderPlotlyRRG(dataset);
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

    sectors.forEach(sec => {
        const fullTrail = sec.trail || [{ x: sec.x, y: sec.y }];
        const trailSlice = fullTrail.slice(-currentTail);
        
        const xPts = trailSlice.map(p => p.x);
        const yPts = trailSlice.map(p => p.y);
        const markerSizes = trailSlice.map((_, idx) => (idx === trailSlice.length - 1 ? 10 : 4));

        traces.push({
            x: xPts,
            y: yPts,
            mode: 'lines+markers+text',
            name: sec.sector,
            text: trailSlice.map((_, idx) => (idx === trailSlice.length - 1 ? ` ${sec.sector}` : '')),
            textposition: 'top right',
            textfont: { size: 10, color: '#f1f5f9' },
            line: { shape: 'spline', smoothing: 1.2, width: 2 }, // Smooth curved tails
            marker: { size: markerSizes }
        });
    });

    const layout = {
        title: {
            text: `NSE SECTOR ROTATION vs NIFTY 500 (${currentMode.toUpperCase()} - ${currentTail} PERIODS)`,
            font: { size: 14, color: '#38bdf8' }
        },
        paper_bgcolor: '#0b1120',
        plot_bgcolor: '#0f172a',
        dragmode: 'pan', // Native pan on left click
        showlegend: true,
        legend: { orientation: 'h', y: -0.15, font: { color: '#94a3b8', size: 10 } },
        margin: { l: 50, r: 40, t: 40, b: 60 },
        xaxis: {
            title: { text: 'JdK RS-Ratio (Relative Strength)', font: { color: '#94a3b8' } },
            gridcolor: '#1e293b',
            zeroline: false,
            tickfont: { color: '#94a3b8' }
        },
        yaxis: {
            title: { text: 'JdK RS-Momentum (Momentum)', font: { color: '#94a3b8' } },
            gridcolor: '#1e293b',
            zeroline: false,
            tickfont: { color: '#94a3b8' }
        },
        shapes: [
            // 4 Colored Quadrants
            { type: 'rect', xref: 'x', yref: 'y', x0: 100, y0: 100, x1: 130, y1: 130, fillcolor: 'rgba(34, 197, 94, 0.08)', line: { width: 0 }, layer: 'below' }, // Leading (Top-Right)
            { type: 'rect', xref: 'x', yref: 'y', x0: 100, y0: 70, x1: 130, y1: 100, fillcolor: 'rgba(245, 158, 11, 0.08)', line: { width: 0 }, layer: 'below' }, // Weakening (Bottom-Right)
            { type: 'rect', xref: 'x', yref: 'y', x0: 70, y0: 70, x1: 100, y1: 100, fillcolor: 'rgba(239, 68, 68, 0.08)', line: { width: 0 }, layer: 'below' }, // Lagging (Bottom-Left)
            { type: 'rect', xref: 'x', yref: 'y', x0: 70, y0: 100, x1: 100, y1: 130, fillcolor: 'rgba(59, 130, 246, 0.08)', line: { width: 0 }, layer: 'below' }, // Improving (Top-Left)
            // Center Reference Axis Lines
            { type: 'line', xref: 'x', yref: 'paper', x0: 100, y0: 0, x1: 100, y1: 1, line: { color: '#38bdf8', width: 1.5, dash: 'dash' } },
            { type: 'line', xref: 'paper', yref: 'y', x0: 0, y0: 100, x1: 1, y1: 100, line: { color: '#38bdf8', width: 1.5, dash: 'dash' } }
        ],
        annotations: [
            { xref: 'paper', yref: 'paper', x: 0.98, y: 0.98, text: 'LEADING', showarrow: false, font: { color: 'rgba(34, 197, 94, 0.4)', size: 14, weight: 'bold' }, xanchor: 'right' },
            { xref: 'paper', yref: 'paper', x: 0.98, y: 0.02, text: 'WEAKENING', showarrow: false, font: { color: 'rgba(245, 158, 11, 0.4)', size: 14, weight: 'bold' }, xanchor: 'right' },
            { xref: 'paper', yref: 'paper', x: 0.02, y: 0.02, text: 'LAGGING', showarrow: false, font: { color: 'rgba(239, 68, 68, 0.4)', size: 14, weight: 'bold' }, xanchor: 'left' },
            { xref: 'paper', yref: 'paper', x: 0.02, y: 0.98, text: 'IMPROVING', showarrow: false, font: { color: 'rgba(59, 130, 246, 0.4)', size: 14, weight: 'bold' }, xanchor: 'left' }
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

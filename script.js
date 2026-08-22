document.addEventListener("DOMContentLoaded", () => {
    fetchDataAndRender();
});

async function fetchDataAndRender() {
    try {
        const response = await fetch("data.json?t=" + new Date().getTime());
        if (!response.ok) throw new Error("Could not load data.json");
        const json = await response.json();

        // 1. Set Timestamp
        const timestampEl = document.getElementById("last-updated");
        if (timestampEl && json.last_updated) {
            timestampEl.textContent = `Last Scraped: ${json.last_updated}`;
        }

        // 2. Populate Quadrant Lists
        populateQuadrants(json.data || []);

        // 3. Render Chart
        renderChart(json.data || []);
    } catch (err) {
        console.error("Failed to load dashboard data:", err);
    }
}

function populateQuadrants(sectors) {
    const categories = {
        Improving: { list: document.getElementById("list-improving"), badge: document.getElementById("badge-improving"), count: 0 },
        Leading: { list: document.getElementById("list-leading"), badge: document.getElementById("badge-leading"), count: 0 },
        Weakening: { list: document.getElementById("list-weakening"), badge: document.getElementById("badge-weakening"), count: 0 },
        Lagging: { list: document.getElementById("list-lagging"), badge: document.getElementById("badge-lagging"), count: 0 }
    };

    // Reset lists
    Object.values(categories).forEach(c => {
        if (c.list) c.list.innerHTML = "";
    });

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

    // Update count badges
    Object.values(categories).forEach(c => {
        if (c.badge) c.badge.textContent = c.count;
    });
}

function renderChart(sectors) {
    const canvas = document.getElementById("rrgChart");
    if (!canvas || typeof Chart === "undefined") return;

    const datasets = sectors.map((sec, i) => {
        const colors = [
            "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7",
            "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
            "#eab308", "#6366f1", "#d946ef", "#64748b"
        ];
        const color = colors[i % colors.length];

        return {
            label: sec.sector,
            data: sec.trail ? sec.trail.map(t => ({ x: t.x, y: t.y })) : [{ x: sec.x, y: sec.y }],
            borderColor: color,
            backgroundColor: color,
            showLine: true,
            pointRadius: (ctx) => ctx.dataIndex === ctx.dataset.data.length - 1 ? 6 : 2,
            borderWidth: 2
        };
    });

    new Chart(canvas, {
        type: "scatter",
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: "JdK RS-Ratio (Relative Strength)", color: "#cbd5e1" },
                    grid: { color: "#334155" },
                    ticks: { color: "#94a3b8" }
                },
                y: {
                    title: { display: true, text: "JdK RS-Momentum (Momentum)", color: "#cbd5e1" },
                    grid: { color: "#334155" },
                    ticks: { color: "#94a3b8" }
                }
            },
            plugins: {
                legend: {
                    labels: { color: "#cbd5e1", boxWidth: 12 }
                }
            }
        }
    });
}

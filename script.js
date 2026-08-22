document.addEventListener("DOMContentLoaded", () => {
    fetchDataAndRender();
});

async function fetchDataAndRender() {
    try {
        const response = await fetch("data.json?t=" + new Date().getTime());
        if (!response.ok) throw new Error("Could not load data.json");
        const json = await response.json();

        // 1. Update Last Updated Text
        const timestampEl = document.getElementById("last-updated");
        if (timestampEl && json.last_updated) {
            timestampEl.textContent = `Last Scraped: ${json.last_updated}`;
        }

        // 2. Populate Statistics & Table
        populateStatsAndTable(json.data || []);

        // 3. Render Chart
        renderChart(json.data || []);
    } catch (err) {
        console.error("Failed to render dashboard:", err);
    }
}

function populateStatsAndTable(sectors) {
    const counts = { Leading: 0, Weakening: 0, Lagging: 0, Improving: 0 };
    const tbody = document.getElementById("stocks-table-body");
    if (tbody) tbody.innerHTML = "";

    sectors.forEach(sec => {
        if (counts[sec.quadrant] !== undefined) {
            counts[sec.quadrant]++;
        }

        if (tbody) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${sec.sector}</strong></td>
                <td><code>${sec.ticker}</code></td>
                <td>${sec.x}</td>
                <td>${sec.y}</td>
                <td><span class="badge ${sec.quadrant.toLowerCase()}">${sec.quadrant}</span></td>
            `;
            tbody.appendChild(tr);
        }
    });

    const setStat = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setStat("stat-leading", counts.Leading);
    setStat("stat-weakening", counts.Weakening);
    setStat("stat-lagging", counts.Lagging);
    setStat("stat-improving", counts.Improving);
}

function renderChart(sectors) {
    const canvas = document.getElementById("rrgChart");
    if (!canvas || typeof Chart === "undefined") return;

    const datasets = sectors.map((sec, i) => {
        const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899", "#14b8a6", "#f97316"];
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
                    labels: { color: "#cbd5e1" }
                }
            }
        }
    });
}

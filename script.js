// Sample Nifty 500 Stock Data
const stocksData = [
    { rank: 1, name: "Tata Consultancy Services", symbol: "TCS", sector: "IT", price: 3245.50, change: 2.45, marketCap: "13.2T" },
    { rank: 2, name: "HDFC Bank", symbol: "HDFCBANK", sector: "Finance", price: 1625.80, change: 1.89, marketCap: "12.1T" },
    { rank: 3, name: "Reliance Industries", symbol: "RELIANCE", sector: "Energy", price: 2892.30, change: -0.75, marketCap: "11.8T" },
    { rank: 4, name: "Infosys", symbol: "INFY", sector: "IT", price: 1852.60, change: 3.12, marketCap: "7.6T" },
    { rank: 5, name: "ICICI Bank", symbol: "ICICIBANK", sector: "Finance", price: 918.50, change: 2.34, marketCap: "6.8T" },
    { rank: 6, name: "Hindustan Unilever", symbol: "HDFCLIFE", sector: "Consumer", price: 752.40, change: 1.56, marketCap: "2.1T" },
    { rank: 7, name: "Axis Bank", symbol: "AXISBANK", sector: "Finance", price: 1198.90, change: 2.78, marketCap: "3.5T" },
    { rank: 8, name: "Larsen and Toubro", symbol: "LT", sector: "Construction", price: 2345.60, change: 1.23, marketCap: "2.8T" },
    { rank: 9, name: "Asian Paints", symbol: "ASIANPAINT", sector: "Consumer", price: 2892.30, change: -1.45, marketCap: "2.4T" },
    { rank: 10, name: "Bajaj Finance", symbol: "BAJAJFINSV", sector: "Finance", price: 1652.80, change: 3.89, marketCap: "2.1T" }
];

// Initialize Page
document.addEventListener('DOMContentLoaded', function() {
    populateStocksTable();
    initializeCharts();
    setupEventListeners();
    updateStats();
});

// Populate Stocks Table
function populateStocksTable(filteredStocks = null) {
    const tbody = document.getElementById('stocksTable');
    const stocks = filteredStocks || stocksData;
    
    tbody.innerHTML = stocks.map(stock => `
        <tr>
            <td>${stock.rank}</td>
            <td>${stock.name}</td>
            <td><strong>${stock.symbol}</strong></td>
            <td>${stock.sector}</td>
            <td>₹${stock.price.toFixed(2)}</td>
            <td class="${stock.change >= 0 ? 'positive' : 'negative'}">
                ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%
            </td>
            <td>${stock.marketCap}</td>
            <td>
                <button class="action-btn" onclick="viewDetails('${stock.symbol}')">View</button>
            </td>
        </tr>
    `).join('');
}

// Update Statistics
function updateStats() {
    const avgChange = (stocksData.reduce((sum, s) => sum + s.change, 0) / stocksData.length).toFixed(2);
    const indexValue = 22500 + (avgChange * 100);
    
    document.getElementById('indexValue').textContent = indexValue.toFixed(2);
    document.getElementById('indexChange').textContent = (avgChange >= 0 ? '+' : '') + avgChange + '%';
    
    const topGainer = stocksData.reduce((prev, current) => 
        (prev.change > current.change) ? prev : current
    );
    document.getElementById('topGainer').textContent = topGainer.symbol;
}

// Initialize Charts
function initializeCharts() {
    // Trend Chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: ['Day 1', 'Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'],
            datasets: [{
                label: 'Nifty 500 Index',
                data: [22000, 22150, 22300, 22200, 22450, 22380, 22500],
                borderColor: '#1e40af',
                backgroundColor: 'rgba(30, 64, 175, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: '#1e40af',
                pointBorderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#f1f5f9' }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#cbd5e1' },
                    grid: { color: '#334155' },
                    beginAtZero: false
                },
                x: {
                    ticks: { color: '#cbd5e1' },
                    grid: { color: '#334155' }
                }
            }
        }
    });

    // Gainers vs Losers Chart
    const gainersCtx = document.getElementById('gainersLosersChart').getContext('2d');
    new Chart(gainersCtx, {
        type: 'doughnut',
        data: {
            labels: ['Gainers', 'Losers'],
            datasets: [{
                data: [65, 35],
                backgroundColor: ['#059669', '#dc2626'],
                borderColor: '#1e293b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: '#f1f5f9' }
                }
            }
        }
    });

    // Sector Distribution Chart
    const sectorCtx = document.getElementById('sectorChart').getContext('2d');
    new Chart(sectorCtx, {
        type: 'bar',
        data: {
            labels: ['IT', 'Finance', 'Healthcare', 'Energy', 'Auto', 'Consumer'],
            datasets: [{
                label: 'Number of Stocks',
                data: [85, 120, 65, 45, 55, 130],
                backgroundColor: [
                    '#1e40af',
                    '#0891b2',
                    '#059669',
                    '#dc2626',
                    '#f59e0b',
                    '#8b5cf6'
                ],
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: '#f1f5f9' }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#cbd5e1' },
                    grid: { color: '#334155' }
                },
                y: {
                    ticks: { color: '#cbd5e1' },
                    grid: { color: '#334155' }
                }
            }
        }
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Search Functionality
    document.getElementById('searchBox').addEventListener('keyup', function(e) {
        const query = e.target.value.toLowerCase();
        const filtered = stocksData.filter(stock => 
            stock.name.toLowerCase().includes(query) ||
            stock.symbol.toLowerCase().includes(query)
        );
        populateStocksTable(filtered);
    });

    // Sector Filter
    document.getElementById('sectorFilter').addEventListener('change', function(e) {
        const sector = e.target.value;
        const filtered = sector ? stocksData.filter(s => s.sector === sector) : stocksData;
        populateStocksTable(filtered);
    });

    // Sort Functionality
    document.getElementById('sortBy').addEventListener('change', function(e) {
        const sortBy = e.target.value;
        let sorted = [...stocksData];
        
        if (sortBy === 'name') {
            sorted.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'price') {
            sorted.sort((a, b) => b.price - a.price);
        } else if (sortBy === 'change') {
            sorted.sort((a, b) => b.change - a.change);
        }
        
        populateStocksTable(sorted);
    });

    // Smooth Scrolling for Navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
                updateActiveNav(this.getAttribute('href'));
            }
        });
    });
}

// View Stock Details
function viewDetails(symbol) {
    const stock = stocksData.find(s => s.symbol === symbol);
    if (stock) {
        alert(`
Stock: ${stock.name}
Symbol: ${stock.symbol}
Price: ₹${stock.price}
Change: ${stock.change}%
Sector: ${stock.sector}
Market Cap: ${stock.marketCap}

Click "OK" to view detailed analysis.
        `);
    }
}

// Scroll to Section
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Update Active Navigation
function updateActiveNav(hash) {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === hash) {
            link.classList.add('active');
        }
    });
}

// Auto-update stats every 5 seconds (simulate real-time data)
setInterval(() => {
    // Simulate small price changes
    stocksData.forEach(stock => {
        const change = (Math.random() - 0.5) * 0.5; // Random change between -0.25% and +0.25%
        stock.change += change;
    });
    updateStats();
}, 5000);

// Format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(value);
}

// Export data to CSV
function exportToCSV() {
    let csv = 'Rank,Name,Symbol,Sector,Price,Change %,Market Cap\n';
    stocksData.forEach(stock => {
        csv += `${stock.rank},"${stock.name}",${stock.symbol},${stock.sector},${stock.price},${stock.change},${stock.marketCap}\n`;
    });
    
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = 'nifty500_stocks.csv';
    link.click();
}

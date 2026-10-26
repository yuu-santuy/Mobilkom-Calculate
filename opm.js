// =====================================================================
// OPM VERIFICATION MODULE
// Aturan Accept/Reject:
//   1. STATUS_COMPLIANCE   : ikut kolom STATUS_COMPLIANCE (Accepted/Rejected)
//   2. AVAILABILITY        : ≥ 1440 → Accept, < 1440 → Reject  (atau ≥ 90% kalau satuannya %)
//   3. RELIABILITY         : ≥ 90 (%) → Accept, < 90 → Reject
//   4. Kolom *_VERIFICATION: Accept jika kolom AVG terkait TIDAK NULL/kosong (ada angka), Reject jika NULL
// =====================================================================

const opmState = {
    allRows: [],
    allRawData: [],
    filteredRows: [],
    paramCols: [],          // kolom *_VERIFICATION beserta pasangan AVG-nya
    allHeaders: [],
    filters: { search: '', status: 'ALL', team: 'ALL', node: 'ALL' },
    charts: {}
};

const OPM_RELIABILITY_THRESHOLD = 90;

// ============================================================
// UPLOAD UI
// ============================================================
const opmDropzone   = document.getElementById('opm-dropzone');
const opmFileInput  = document.getElementById('opm-file-input');
const opmFileInfo   = document.getElementById('opm-file-info');
const opmFileName   = document.getElementById('opm-file-name');
const opmProcessBtn = document.getElementById('opm-process-btn');
const opmError      = document.getElementById('opm-upload-error');

let opmSelectedFiles = null;

opmDropzone.addEventListener('click', () => opmFileInput.click());
opmDropzone.addEventListener('dragover', e => { e.preventDefault(); opmDropzone.classList.add('dragover'); });
opmDropzone.addEventListener('dragleave', () => opmDropzone.classList.remove('dragover'));
opmDropzone.addEventListener('drop', e => {
    e.preventDefault(); opmDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) selectOpmFiles(Array.from(e.dataTransfer.files));
});
opmFileInput.addEventListener('change', e => { if (e.target.files.length) selectOpmFiles(Array.from(e.target.files)); });

function selectOpmFiles(files) {
    const bad = files.find(f => !['xls','xlsx','csv'].includes(f.name.split('.').pop().toLowerCase()));
    if (bad) { opmError.textContent = `⚠ Format "${bad.name}" tidak didukung.`; opmError.classList.remove('hidden'); return; }
    opmError.classList.add('hidden');
    opmSelectedFiles = files;
    opmFileName.textContent = files.length === 1 ? `File: ${files[0].name}` : `${files.length} file terpilih`;
    opmFileInfo.classList.remove('hidden');
}

opmProcessBtn.addEventListener('click', () => { if (opmSelectedFiles) processOpmFiles(opmSelectedFiles); });

// ============================================================
// PARSE + PROCESS
// ============================================================
async function processOpmFiles(files) {
    opmFileInfo.classList.add('hidden');
    document.getElementById('opm-loading').classList.remove('hidden');

    try {
        await opmSetProgress('Membaca file...', 15);

        let allRaw = [];
        let detectedHeaders = null;

        for (const file of files) {
            const ext = file.name.split('.').pop().toLowerCase();
            let workbook;
            if (ext === 'csv') {
                const text = await file.text();
                workbook = XLSX.read(text, { type: 'string', cellDates: true });
            } else {
                const buf = await file.arrayBuffer();
                workbook = XLSX.read(buf, { type: 'array', cellDates: true });
            }
            for (const sheetName of workbook.SheetNames) {
                const ws = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
                if (rows.length === 0) continue;
                if (!detectedHeaders) detectedHeaders = Object.keys(rows[0]);
                allRaw = allRaw.concat(rows);
            }
        }
        opmState.allRawData = allRaw; // Simpan data mentah untuk export

        if (allRaw.length === 0) throw new Error('Tidak ada baris data yang terbaca dari file.');

        await opmSetProgress('Mendeteksi kolom & aturan...', 40);

        const headers = detectedHeaders || Object.keys(allRaw[0]);
        opmState.allHeaders = headers;

        // Deteksi kolom penting (case-insensitive, flexible)
        const h = k => headers.find(x => x.toUpperCase().includes(k.toUpperCase()));
        const COL = {
            RTU_ID:           h('RTU_ID')      || h('RTU'),
            REPORT_DATE:      h('REPORT_DATE') || h('DATE'),
            FACILITY_NAME:    h('FACILITY_NAME') || h('FACILITY') || h('NAME'),
            OPS_TEAM:         h('OPS_TEAM')    || h('TEAM'),
            NODE_TYPE:        h('NODE_TYPE')   || h('NODE'),
            AVAILABILITY:     h('AVAILABILITY'),
            RELIABILITY:      h('RELIABILITY'),
            STATUS_COMPLIANCE:h('STATUS_COMPLIANCE') || h('STATUS'),
            NODE_MAPPING:     h('NODE_MAPPING'),
            AVG_TEMP1:        h('AVG_TEMP_1') || h('AVG_TEMP1'),
            AVG_TEMP2:        h('AVG_TEMP_2') || h('AVG_TEMP2'),
            AVG_TEMP3:        h('AVG_TEMP_3') || h('AVG_TEMP3'),
            AVG_TEMP4:        h('AVG_TEMP_4') || h('AVG_TEMP4'),
            AVG_WL:           h('AVG_WATER_LEVEL') || h('AVG_WL'),
            AVG_PRESS:        h('AVG_PRESSURE') || h('AVG_PRESS'),
        };

        // Deteksi pasangan AVG → VERIFICATION secara otomatis
        // AVG_XXX → XXX_VERIFICATION atau AVG_XXX → (nama kolom verif yg mengandung bagian nama yang sama)
        const verifCols = headers.filter(h => h.toUpperCase().includes('VERIFICATION'));
        const avgCols   = headers.filter(h => h.toUpperCase().startsWith('AVG_'));
        const paramPairs = [];
        for (const vc of verifCols) {
            // Cari pasangan AVG yang paling cocok (nama terpanjang yang sama)
            const vcKey = vc.toUpperCase().replace('_VERIFICATION','').replace('_NDC','').trim();
            let bestAvg = null, bestScore = 0;
            for (const ac of avgCols) {
                const acKey = ac.toUpperCase().replace('AVG_','').replace('_NDC','').trim();
                if (acKey === vcKey || vc.toUpperCase().includes(acKey) || acKey.includes(vcKey)) {
                    const score = acKey.length;
                    if (score > bestScore) { bestScore = score; bestAvg = ac; }
                }
            }
            paramPairs.push({ verifCol: vc, avgCol: bestAvg, label: vc.replace('_VERIFICATION','').replace(/_/g,' ') });
        }
        opmState.paramCols = paramPairs;

        await opmSetProgress('Menghitung Accept/Reject...', 70);

        // Proses setiap baris
        opmState.allRows = allRaw.map((raw, i) => {
            const rtu = raw[COL.RTU_ID];
            const dateRaw = raw[COL.REPORT_DATE];
            const date = opmParseDate(dateRaw);
            const facility = raw[COL.FACILITY_NAME] || '';
            const team = raw[COL.OPS_TEAM] || '';
            const nodeType = raw[COL.NODE_TYPE] || '';
            const avail = parseFloat(raw[COL.AVAILABILITY]);
            const reliab = parseFloat(raw[COL.RELIABILITY]);
            const statusCompliance = raw[COL.STATUS_COMPLIANCE] || '';

            // STATUS utama:
            // - Jika ada kolom STATUS_COMPLIANCE, pakai itu sebagai acuan utama
            // - Kalau reliability ada dan < threshold → Rejected
            // - Kalau reliability ≥ threshold → Accepted
            let statusMain;
            if (statusCompliance) {
                statusMain = statusCompliance.trim();
            } else if (!isNaN(reliab)) {
                statusMain = reliab >= OPM_RELIABILITY_THRESHOLD ? 'Accepted' : 'Rejected';
            } else {
                statusMain = 'Rejected';
            }

            // Hitung status RELIABILITY terpisah
            const reliabStatus = (!isNaN(reliab) && reliab >= OPM_RELIABILITY_THRESHOLD) ? 'Accepted' : 'Rejected';

            // Hitung status AVAILABILITY terpisah
            // Di data ini availability dalam menit (max 1440), ≥ 90% dari 1440 = ≥ 1296 → Accept
            let availStatus = 'N/A';
            if (!isNaN(avail)) {
                const availPct = avail > 100 ? (avail / 1440 * 100) : avail; // normalisasi
                availStatus = availPct >= 90 ? 'Accepted' : 'Rejected';
            }

            // Hitung status setiap parameter verifikasi
            const paramStatuses = {};
            for (const pp of paramPairs) {
                const vcVal = raw[pp.verifCol]; // nilai dari kolom *_VERIFICATION (Accepted/Rejected)
                const avgVal = raw[pp.avgCol];   // nilai dari kolom AVG_*
                // Prioritas: kalau kolom VERIFICATION sudah ada isinya, pakai itu
                // Kalau tidak ada, hitung sendiri dari AVG (ada angka = Accept)
                let pStatus;
                if (vcVal && (vcVal === 'Accepted' || vcVal === 'Rejected')) {
                    pStatus = vcVal;
                } else {
                    pStatus = (avgVal !== null && avgVal !== '' && !isNaN(parseFloat(avgVal))) ? 'Accepted' : 'Rejected';
                }
                paramStatuses[pp.verifCol] = pStatus;
            }

            return {
                _idx: i,
                rtu, date, dateRaw,
                facility, team, nodeType,
                avail, reliab,
                statusCompliance, statusMain,
                reliabStatus, availStatus,
                paramStatuses,
                raw
            };
        });

        await opmSetProgress('Menyusun tampilan...', 95);

        // Isi dropdown filter
        populateOpmDropdowns();
        opmState.filteredRows = [...opmState.allRows];
        renderOpmDashboard();

        document.getElementById('opm-loading').classList.add('hidden');
        document.getElementById('opm-dashboard').classList.remove('hidden');
        opmFileInput.value = '';
        opmSelectedFiles = null;
        showToast(`✅ ${opmState.allRows.length} baris OPM berhasil diproses.`, 'success');

    } catch (err) {
        document.getElementById('opm-loading').classList.add('hidden');
        opmFileInfo.classList.remove('hidden');
        opmError.textContent = `⚠ ${err.message}`;
        opmError.classList.remove('hidden');
    }
}

function opmParseDate(v) {
    if (!v) return '';
    if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
    const s = String(v).trim();
    const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
        const y = m[3].length === 2 ? '20'+m[3] : m[3];
        return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    }
    return s.split('T')[0];
}

async function opmSetProgress(msg, pct) {
    document.getElementById('opm-loading-msg').textContent = msg;
    document.getElementById('opm-progress-bar').style.width = pct + '%';
    return new Promise(r => setTimeout(r, 80));
}

// ============================================================
// DROPDOWN FILTER
// ============================================================
function populateOpmDropdowns() {
    const teams = [...new Set(opmState.allRows.map(r => r.team).filter(Boolean))].sort();
    const nodes = [...new Set(opmState.allRows.map(r => r.nodeType).filter(Boolean))].sort();
    const teamSel = document.getElementById('opm-team-filter');
    const nodeSel = document.getElementById('opm-node-filter');
    teamSel.innerHTML = '<option value="ALL">Semua Tim</option>' + teams.map(t => `<option value="${t}">${t}</option>`).join('');
    nodeSel.innerHTML = '<option value="ALL">Semua Node</option>' + nodes.map(n => `<option value="${n}">${n}</option>`).join('');
}

document.getElementById('opm-search').addEventListener('input', e => { opmState.filters.search = e.target.value.toLowerCase(); applyOpmFilters(); });
document.getElementById('opm-team-filter').addEventListener('change', e => { opmState.filters.team = e.target.value; applyOpmFilters(); });
document.getElementById('opm-node-filter').addEventListener('change', e => { opmState.filters.node = e.target.value; applyOpmFilters(); });
document.querySelectorAll('#page-opm .status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#page-opm .status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        opmState.filters.status = btn.dataset.ostatus;
        applyOpmFilters();
    });
});
document.getElementById('opm-reset-filter').addEventListener('click', () => {
    opmState.filters = { search: '', status: 'ALL', team: 'ALL', node: 'ALL' };
    document.getElementById('opm-search').value = '';
    document.getElementById('opm-team-filter').value = 'ALL';
    document.getElementById('opm-node-filter').value = 'ALL';
    document.querySelectorAll('#page-opm .status-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#page-opm .status-btn[data-ostatus="ALL"]').classList.add('active');
    applyOpmFilters();
});

function applyOpmFilters() {
    const { search, status, team, node } = opmState.filters;
    opmState.filteredRows = opmState.allRows.filter(r => {
        if (status !== 'ALL' && r.statusMain !== status) return false;
        if (team !== 'ALL' && r.team !== team) return false;
        if (node !== 'ALL' && r.nodeType !== node) return false;
        if (search && !(String(r.rtu).toLowerCase().includes(search) || r.facility.toLowerCase().includes(search))) return false;
        return true;
    });
    renderOpmMainTable();
    renderOpmSummaryCards();
}

// ============================================================
// TAB SWITCHING
// ============================================================
document.querySelectorAll('.opm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.opm-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.otab;
        document.querySelectorAll('.opm-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById(`opm-panel-${target}`).classList.remove('hidden');
        if (target === 'summary-daily') renderOpmDailyPanel();
        if (target === 'summary-monthly') renderOpmMonthlyPanel();
        if (target === 'params') renderOpmParamsPanel();
    });
});

// ============================================================
// RENDER DASHBOARD
// ============================================================
function renderOpmDashboard() {
    renderOpmTableHeaders();
    renderOpmSummaryCards();
    renderOpmMainTable();
}

// Generate dynamic table headers berdasarkan detected paramCols
function renderOpmTableHeaders() {
    const paramCols = opmState.paramCols;
    
    // Daily table header
    const dailyHeaderRow = document.querySelector('#opm-daily-table thead tr');
    if (dailyHeaderRow) {
        // Clear existing param headers (Temp 1 dst)
        const existingParamHeaders = dailyHeaderRow.querySelectorAll('th:nth-child(n+10)');
        existingParamHeaders.forEach(th => th.remove());
        
        // Add dynamic param headers
        paramCols.forEach(pc => {
            const th = document.createElement('th');
            th.textContent = pc.label;
            dailyHeaderRow.appendChild(th);
        });
    }
    
    // Monthly table header
    const monthlyHeaderRow = document.querySelector('#opm-monthly-table thead tr');
    if (monthlyHeaderRow) {
        // Clear existing param headers
        const existingParamHeaders = monthlyHeaderRow.querySelectorAll('th:nth-child(n+10)');
        existingParamHeaders.forEach(th => th.remove());
        
        // Add dynamic param headers
        paramCols.forEach(pc => {
            const th = document.createElement('th');
            th.textContent = pc.label;
            monthlyHeaderRow.appendChild(th);
        });
    }
}

function renderOpmSummaryCards() {
    const rows = opmState.filteredRows;
    const total = rows.length;
    const accepted = rows.filter(r => r.statusMain === 'Accepted').length;
    const rejected = total - accepted;
    const rate = total ? ((accepted / total) * 100).toFixed(1) : '0.0';
    const avgReliab = total ? (rows.reduce((s, r) => s + (isNaN(r.reliab) ? 0 : r.reliab), 0) / total).toFixed(2) : '-';

    document.getElementById('opm-summary-cards').innerHTML = `
        <div class="summary-card"><h4>Total Baris</h4><h2>${total}</h2></div>
        <div class="summary-card summary-green"><h4>✅ Accepted</h4><h2>${accepted}</h2></div>
        <div class="summary-card summary-red"><h4>❌ Rejected</h4><h2>${rejected}</h2></div>
        <div class="summary-card"><h4>Accept Rate</h4><h2>${rate}%</h2></div>
        <div class="summary-card"><h4>Avg Reliability</h4><h2>${avgReliab}%</h2></div>
    `;
}

function renderOpmMainTable() {
    const rows = opmState.filteredRows;
    const thead = document.getElementById('opm-main-thead');
    const tbody = document.getElementById('opm-main-tbody');
    const empty = document.getElementById('opm-table-empty');

    // Kolom utama yang selalu tampil
    const fixedCols = ['RTU_ID','REPORT_DATE','FACILITY_NAME','OPS_TEAM','NODE_TYPE','AVAILABILITY','RELIABILITY'];
    const paramVCols = opmState.paramCols.map(p => p.verifCol);
    const cols = [...fixedCols, 'STATUS_COMPLIANCE', ...paramVCols];

    // Header
    thead.innerHTML = `<tr>${cols.map(c => `<th>${c.replace(/_/g,' ')}</th>`).join('')}</tr>`;

    if (rows.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    tbody.innerHTML = rows.map(r => {
        const isAccepted = r.statusMain === 'Accepted';
        const cells = cols.map(c => {
            if (paramVCols.includes(c)) {
                const v = r.paramStatuses[c] || r.raw[c] || '-';
                const cls = v === 'Accepted' ? 'opm-accepted' : v === 'Rejected' ? 'opm-rejected' : '';
                return `<td class="${cls}">${v}</td>`;
            }
            const v = r.raw[c];
            const display = v === null || v === undefined ? '<span class="opm-null">—</span>' : v;
            return `<td>${display}</td>`;
        }).join('');
        return `<tr class="${isAccepted ? 'status-green' : 'status-red'}">${cells}</tr>`;
    }).join('');
}

// ============================================================
// RINGKASAN HARIAN (Independent per verification type)
// ============================================================
function renderOpmDailyPanel() {
    const rows = opmState.allRows;
    const paramCols = opmState.paramCols;
    const dailyMap = {};

    rows.forEach(r => {
        const date = r.date || 'Unknown';
        const rtu = r.rtu || '-';
        const facility = r.facility || '-';
        const team = r.team || '-';
        const nodeType = r.nodeType || '-';
        const key = `${date}__${rtu}__${facility}__${team}__${nodeType}`;

        if (!dailyMap[key]) {
            dailyMap[key] = {
                date, rtu, facility, team, nodeType,
                totalRecords: 0,
                statusAccepted: 0,
                statusRejected: 0,
                paramCounts: {} // per verification column
            };
            // Initialize param counts
            paramCols.forEach(pc => {
                dailyMap[key].paramCounts[pc.verifCol] = 0;
            });
        }

        dailyMap[key].totalRecords++;
        if (r.statusMain === 'Accepted') {
            dailyMap[key].statusAccepted++;
        } else {
            dailyMap[key].statusRejected++;
        }

        // Count each verification type independently
        paramCols.forEach(pc => {
            if (r.paramStatuses[pc.verifCol] === 'Accepted') {
                dailyMap[key].paramCounts[pc.verifCol]++;
            }
        });
    });

    const summaryList = Object.values(dailyMap).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.rtu).localeCompare(String(b.rtu), undefined, { numeric: true });
    });

    const tbody = document.getElementById('opm-daily-tbody');
    tbody.innerHTML = summaryList.map(item => {
        const rate = item.totalRecords ? ((item.statusAccepted / item.totalRecords) * 100).toFixed(1) : '0.0';
        const cls = item.statusAccepted === item.totalRecords ? 'status-green' : item.statusAccepted === 0 ? 'status-red' : '';
        
        const paramCells = paramCols.map(pc => {
            const count = item.paramCounts[pc.verifCol] || 0;
            const cellCls = count > 0 ? 'opm-accepted' : 'opm-rejected';
            return `<td class="${cellCls}">${count}</td>`;
        }).join('');

        return `<tr class="${cls}">
            <td>${item.date}</td>
            <td><b>${item.rtu}</b></td>
            <td>${item.facility}</td>
            <td>${item.team}</td>
            <td>${item.nodeType}</td>
            <td>${item.totalRecords}</td>
            <td class="opm-accepted">${item.statusAccepted}</td>
            <td class="opm-rejected">${item.statusRejected}</td>
            <td>${rate}%</td>
            ${paramCells}
        </tr>`;
    }).join('');

    // Chart harian agregat per tanggal
    const aggByDate = {};
    rows.forEach(r => {
        const d = r.date || 'Unknown';
        if (!aggByDate[d]) aggByDate[d] = { accepted: 0, rejected: 0 };
        if (r.statusMain === 'Accepted') aggByDate[d].accepted++;
        else aggByDate[d].rejected++;
    });
    const dates = Object.keys(aggByDate).sort();

    if (opmState.charts.daily) opmState.charts.daily.destroy();
    const ctx = document.getElementById('opm-daily-chart').getContext('2d');
    opmState.charts.daily = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                { label: 'Accepted', data: dates.map(d => aggByDate[d].accepted), backgroundColor: 'rgba(46,125,50,0.75)', borderRadius: 4 },
                { label: 'Rejected', data: dates.map(d => aggByDate[d].rejected), backgroundColor: 'rgba(198,40,40,0.7)', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
        }
    });
}

// ============================================================
// RINGKASAN BULANAN (Independent per verification type)
// ============================================================
function renderOpmMonthlyPanel() {
    const rows = opmState.allRows;
    const paramCols = opmState.paramCols;
    const monthlyMap = {};

    rows.forEach(r => {
        const month = r.date ? r.date.substring(0, 7) : 'Unknown';
        const rtu = r.rtu || '-';
        const facility = r.facility || '-';
        const team = r.team || '-';
        const nodeType = r.nodeType || '-';
        const key = `${month}__${rtu}__${facility}__${team}__${nodeType}`;

        if (!monthlyMap[key]) {
            monthlyMap[key] = {
                month,
                rtu,
                facility,
                team,
                nodeType,
                totalDays: 0,
                statusAccepted: 0,
                statusRejected: 0,
                paramCounts: {} // per verification column
            };
            // Initialize param counts
            paramCols.forEach(pc => {
                monthlyMap[key].paramCounts[pc.verifCol] = 0;
            });
        }

        monthlyMap[key].totalDays++;
        if (r.statusMain === 'Accepted') {
            monthlyMap[key].statusAccepted++;
        } else {
            monthlyMap[key].statusRejected++;
        }

        // Count each verification type independently
        paramCols.forEach(pc => {
            if (r.paramStatuses[pc.verifCol] === 'Accepted') {
                monthlyMap[key].paramCounts[pc.verifCol]++;
            }
        });
    });

    const summaryList = Object.values(monthlyMap).sort((a, b) => {
        if (a.month !== b.month) return a.month.localeCompare(b.month);
        return String(a.rtu).localeCompare(String(b.rtu), undefined, { numeric: true });
    });

    const tbody = document.getElementById('opm-monthly-tbody');
    tbody.innerHTML = summaryList.map(item => {
        const rate = item.totalDays ? ((item.statusAccepted / item.totalDays) * 100).toFixed(1) : '0.0';
        const cls = item.statusAccepted === item.totalDays ? 'status-green' : item.statusAccepted === 0 ? 'status-red' : '';
        
        const paramCells = paramCols.map(pc => {
            const count = item.paramCounts[pc.verifCol] || 0;
            const cellCls = count > 0 ? 'opm-accepted' : 'opm-rejected';
            return `<td class="${cellCls}">${count}</td>`;
        }).join('');

        return `<tr class="${cls}">
            <td>${item.month}</td>
            <td><b>${item.rtu}</b></td>
            <td>${item.facility}</td>
            <td>${item.team}</td>
            <td>${item.nodeType}</td>
            <td>${item.totalDays}</td>
            <td class="opm-accepted">${item.statusAccepted}</td>
            <td class="opm-rejected">${item.statusRejected}</td>
            <td>${rate}%</td>
            ${paramCells}
        </tr>`;
    }).join('');

    // Chart bulanan agregat
    const aggByMonth = {};
    rows.forEach(r => {
        const m = r.date ? r.date.substring(0, 7) : 'Unknown';
        if (!aggByMonth[m]) aggByMonth[m] = { total: 0, accepted: 0, rejected: 0 };
        aggByMonth[m].total++;
        if (r.statusMain === 'Accepted') aggByMonth[m].accepted++;
        else aggByMonth[m].rejected++;
    });
    const months = Object.keys(aggByMonth).sort();

    if (opmState.charts.monthly) opmState.charts.monthly.destroy();
    const ctx = document.getElementById('opm-monthly-chart').getContext('2d');
    opmState.charts.monthly = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: months.map(m => `${m} — ${aggByMonth[m].accepted}/${aggByMonth[m].total} Accepted`),
            datasets: [{
                data: months.map(m => aggByMonth[m].accepted),
                backgroundColor: ['#2e7d32','#1565c0','#ef6c00','#6a1b9a','#c62828']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}

// ============================================================
// ANALISIS PARAMETER
// ============================================================
function renderOpmParamsPanel() {
    const rows = opmState.allRows;
    const paramPairs = opmState.paramCols;
    const grid = document.getElementById('opm-params-grid');
    const labels = [], acceptedCounts = [], rejectedCounts = [];

    grid.innerHTML = paramPairs.map(pp => {
        const accepted = rows.filter(r => r.paramStatuses[pp.verifCol] === 'Accepted').length;
        const rejected = rows.length - accepted;
        const rate = rows.length ? ((accepted / rows.length) * 100).toFixed(1) : '0.0';
        labels.push(pp.label); acceptedCounts.push(accepted); rejectedCounts.push(rejected);
        return `
        <div class="opm-param-card">
            <h4>${pp.label}</h4>
            <div class="opm-param-counts">
                <span class="opm-accepted">✅ ${accepted} Accepted</span>
                <span class="opm-rejected">❌ ${rejected} Rejected</span>
            </div>
            <div class="opm-mini-bar">
                <div style="width:${rate}%;background:#2e7d32" title="${rate}% Accepted"></div>
                <div style="width:${100-rate}%;background:#c62828" title="${100-rate}% Rejected"></div>
            </div>
            <small>${rate}% Accept Rate</small>
        </div>`;
    }).join('');

    if (opmState.charts.params) opmState.charts.params.destroy();
    const ctx = document.getElementById('opm-params-chart').getContext('2d');
    opmState.charts.params = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Accepted', data: acceptedCounts, backgroundColor: 'rgba(46,125,50,0.75)', borderRadius: 4 },
                { label: 'Rejected', data: rejectedCounts, backgroundColor: 'rgba(198,40,40,0.7)', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: { legend: { position: 'bottom' } },
            scales: { x: { stacked: true, beginAtZero: true }, y: { stacked: true } }
        }
    });
}

// ============================================================
// EXPORT EXCEL
// ============================================================
document.getElementById('opm-export-excel').addEventListener('click', async () => {
    if (opmState.allRows.length === 0) { alert('Tidak ada data.'); return; }
    const wb = new ExcelJS.Workbook();
    const NAVY = 'FF1F3864';

    // Sheet 1: Detail
    const ws = wb.addWorksheet('Detail OPM');
    const fixedCols = ['RTU_ID','REPORT_DATE','FACILITY_NAME','OPS_TEAM','NODE_TYPE','AVAILABILITY','RELIABILITY'];
    const paramVCols = opmState.paramCols.map(p => p.verifCol);
    const cols = [...fixedCols, 'STATUS_COMPLIANCE', ...paramVCols];
    const hdrRow = ws.addRow(cols.map(c => c.replace(/_/g,' ')));
    hdrRow.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    opmState.allRows.forEach(r => {
        const vals = cols.map(c => {
            if (paramVCols.includes(c)) return r.paramStatuses[c] || r.raw[c] || '';
            const v = r.raw[c]; return v === null || v === undefined ? '' : v;
        });
        const row = ws.addRow(vals);
        const isAcc = r.statusMain === 'Accepted';
        const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAcc ? 'FFC8E6C9' : 'FFFFCDD2' } };
        row.eachCell(c => { c.fill = fill; c.border = { top: { style: 'thin', color: { argb: 'FFD0D7E2' } }, bottom: { style: 'thin', color: { argb: 'FFD0D7E2' } }, left: { style: 'thin', color: { argb: 'FFD0D7E2' } }, right: { style: 'thin', color: { argb: 'FFD0D7E2' } } }; });
        // Warna kolom verifikasi
        paramVCols.forEach(vc => {
            const realColIdx = cols.indexOf(vc) + 1;
            const cellVal = r.paramStatuses[vc];
            const cell = row.getCell(realColIdx);
            if (cellVal === 'Accepted') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };
            else if (cellVal === 'Rejected') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
        });
    });
    ws.columns.forEach(c => { c.width = 16; });

    // Sheet 2: Ringkasan Harian (Per RTU ID + Facility Name + OPS Team + Node Type + DATE)
    const ws2 = wb.addWorksheet('Ringkasan Harian');
    const paramLabels = opmState.paramCols.map(p => p.label);
    const h2Headers = ['Tanggal','RTU ID','Facility Name','OPS Team','Node Type','Total Record','Status Accept','Status Reject','Accept Rate (%)'].concat(paramLabels);
    const h2 = ws2.addRow(h2Headers);
    h2.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { horizontal: 'center', wrapText: true }; });

    const dailyMap = {};
    opmState.allRows.forEach(r => {
        const date = r.date || 'Unknown';
        const rtu = r.rtu || '-';
        const facility = r.facility || '-';
        const team = r.team || '-';
        const nodeType = r.nodeType || '-';
        const key = `${date}__${rtu}__${facility}__${team}__${nodeType}`;
        if (!dailyMap[key]) {
            dailyMap[key] = {
                date, rtu, facility, team, nodeType,
                totalRecords: 0,
                statusAccepted: 0,
                statusRejected: 0,
                paramCounts: {}
            };
            opmState.paramCols.forEach(pc => {
                dailyMap[key].paramCounts[pc.verifCol] = 0;
            });
        }
        dailyMap[key].totalRecords++;
        if (r.statusMain === 'Accepted') dailyMap[key].statusAccepted++;
        else dailyMap[key].statusRejected++;
        
        opmState.paramCols.forEach(pc => {
            if (r.paramStatuses[pc.verifCol] === 'Accepted') {
                dailyMap[key].paramCounts[pc.verifCol]++;
            }
        });
    });

    Object.values(dailyMap).sort((a,b) => a.date.localeCompare(b.date) || String(a.rtu).localeCompare(String(b.rtu), undefined, {numeric:true})).forEach(item => {
        const rate = ((item.statusAccepted / item.totalRecords) * 100).toFixed(1);
        const paramVals = opmState.paramCols.map(pc => item.paramCounts[pc.verifCol] || 0);
        const row = ws2.addRow([
            item.date, item.rtu, item.facility, item.team, item.nodeType,
            item.totalRecords, item.statusAccepted, item.statusRejected, parseFloat(rate)
        ].concat(paramVals));
        row.getCell(9).numFmt = '0.0"%"';
        const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.statusAccepted === item.totalRecords ? 'FFC8E6C9' : item.statusAccepted === 0 ? 'FFFFCDD2' : 'FFFFF3CD' } };
        row.eachCell(c => c.fill = fill);
    });
    ws2.columns.forEach(c => c.width = 18);

    // Sheet 4: Data Gabungan
    const ws4 = wb.addWorksheet('Data Gabungan');
    const cols4 = opmState.allHeaders;
    // Gunakan header ASLI persis seperti di file Excel (tanpa ubah underscore/spasi)
    const hdrRow4 = ws4.addRow(cols4);
    hdrRow4.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    });
    opmState.allRawData.forEach(r => {
        ws4.addRow(cols4.map(c => r[c] ?? ''));
    });
    ws4.columns.forEach(c => { c.width = 18; });

    // Sheet 3: Ringkasan Bulanan (Per RTU ID + Facility Name + OPS Team + Node Type)
    const ws3 = wb.addWorksheet('Ringkasan Bulanan');
    const h3Headers = ['Bulan','RTU ID','Facility Name','OPS Team','Node Type','Total Hari','Status Accept','Status Reject','Accept Rate (%)'].concat(paramLabels);
    const h3 = ws3.addRow(h3Headers);
    h3.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { horizontal: 'center', wrapText: true }; });

    const monthlyMap = {};
    opmState.allRows.forEach(r => {
        const month = r.date ? r.date.substring(0,7) : 'Unknown';
        const rtu = r.rtu || '-';
        const facility = r.facility || '-';
        const team = r.team || '-';
        const nodeType = r.nodeType || '-';
        const key = `${month}__${rtu}__${facility}__${team}__${nodeType}`;
        if (!monthlyMap[key]) {
            monthlyMap[key] = {
                month, rtu, facility, team, nodeType,
                totalDays: 0, statusAccepted: 0, statusRejected: 0,
                paramCounts: {}
            };
            opmState.paramCols.forEach(pc => {
                monthlyMap[key].paramCounts[pc.verifCol] = 0;
            });
        }
        monthlyMap[key].totalDays++;
        if (r.statusMain === 'Accepted') monthlyMap[key].statusAccepted++;
        else monthlyMap[key].statusRejected++;
        
        opmState.paramCols.forEach(pc => {
            if (r.paramStatuses[pc.verifCol] === 'Accepted') {
                monthlyMap[key].paramCounts[pc.verifCol]++;
            }
        });
    });

    Object.values(monthlyMap).sort((a,b) => a.month.localeCompare(b.month) || String(a.rtu).localeCompare(String(b.rtu), undefined, {numeric:true})).forEach(item => {
        const rate = ((item.statusAccepted / item.totalDays) * 100).toFixed(1);
        const paramVals = opmState.paramCols.map(pc => item.paramCounts[pc.verifCol] || 0);
        const row = ws3.addRow([
            item.month, item.rtu, item.facility, item.team, item.nodeType,
            item.totalDays, item.statusAccepted, item.statusRejected, parseFloat(rate)
        ].concat(paramVals));
        row.getCell(9).numFmt = '0.0"%"';
        const fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item.statusAccepted === item.totalDays ? 'FFC8E6C9' : item.statusAccepted === 0 ? 'FFFFCDD2' : 'FFFFF3CD' } };
        row.eachCell(c => c.fill = fill);
    });
    ws3.columns.forEach(c => c.width = 18);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'OPM_Verification_Report.xlsx';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// ============================================================
// EXPORT PDF
// ============================================================
document.getElementById('opm-export-pdf').addEventListener('click', () => {
    if (opmState.allRows.length === 0) { alert('Tidak ada data.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const W = 297;

    doc.setFillColor(31,56,100); doc.rect(0,0,W,10,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont(undefined,'bold');
    doc.text('OPM VERIFICATION REPORT', W/2, 7, { align: 'center' });

    // Halaman 1: Detail per baris (STATUS_COMPLIANCE + RELIABILITY)
    const bodyData = opmState.allRows.map(r => [
        String(r.rtu), r.date, r.facility.substring(0,30), r.team, r.nodeType,
        r.avail || '-', isNaN(r.reliab) ? '-' : r.reliab.toFixed(2) + '%',
        r.statusMain
    ]);
    doc.autoTable({
        startY: 14,
        head: [['RTU ID','Tanggal','Fasilitas','Tim','Node','Availability','Reliability','Status']],
        body: bodyData,
        headStyles: { fillColor: [31,56,100], textColor: 255, fontSize: 7.5 },
        bodyStyles: { fontSize: 7 },
        didParseCell: h => {
            if (h.section === 'body' && h.column.index === 7) {
                const isAcc = h.cell.raw === 'Accepted';
                h.cell.styles.fillColor = isAcc ? [200,230,201] : [255,205,210];
                h.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // Halaman 2: Ringkasan Harian (Per RTU ID + Facility Name + OPS Team + Node Type)
    doc.addPage();
    doc.setFillColor(31,56,100); doc.rect(0,0,W,10,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont(undefined,'bold');
    doc.text('RINGKASAN HARIAN PER RTU / FASILITAS', W/2, 7, { align: 'center' });

    // [FIX 3] Gunakan paramCols dinamis — tidak lagi hardcode T1/T2/T3/T4/WL/Press
    const paramCols = opmState.paramCols;

    const dailyPdfMap = {};
    opmState.allRows.forEach(r => {
        const date = r.date || 'Unknown';
        const rtu = r.rtu || '-';
        const facility = r.facility || '-';
        const team = r.team || '-';
        const nodeType = r.nodeType || '-';
        const key = `${date}__${rtu}__${facility}__${team}__${nodeType}`;
        if (!dailyPdfMap[key]) {
            const paramAccepted = {};
            paramCols.forEach(pc => { paramAccepted[pc.verifCol] = 0; });
            dailyPdfMap[key] = { date, rtu, facility, team, nodeType, total: 0, accepted: 0, paramAccepted };
        }
        dailyPdfMap[key].total++;
        if (r.statusMain === 'Accepted') dailyPdfMap[key].accepted++;
        paramCols.forEach(pc => {
            if (r.paramStatuses[pc.verifCol] === 'Accepted') dailyPdfMap[key].paramAccepted[pc.verifCol]++;
        });
    });

    const dailyPdfList = Object.values(dailyPdfMap).sort((a,b) => a.date.localeCompare(b.date) || String(a.rtu).localeCompare(String(b.rtu), undefined, {numeric:true}));
    const dailyParamHeaders = paramCols.map(pc => pc.label.length > 8 ? pc.label.substring(0,8) : pc.label);

    doc.autoTable({
        startY: 14,
        head: [['Tanggal','RTU','Facility','Team','Node','Tot','Acc','Rej','Rate', ...dailyParamHeaders]],
        body: dailyPdfList.map(item => {
            const rejected = item.total - item.accepted;
            const rate = item.total ? ((item.accepted / item.total) * 100).toFixed(1) + '%' : '0.0%';
            const paramVals = paramCols.map(pc => item.paramAccepted[pc.verifCol] > 0 ? String(item.paramAccepted[pc.verifCol]) : 'Rej');
            return [item.date, String(item.rtu), item.facility.substring(0,15), item.team, item.nodeType, item.total, item.accepted, rejected, rate, ...paramVals];
        }),
        headStyles: { fillColor: [31,56,100], textColor: 255, fontSize: 6.5 },
        bodyStyles: { fontSize: 6 },
        didParseCell: h => {
            if (h.section === 'body' && h.column.index === 6) {
                h.cell.styles.textColor = [27,94,32];
                h.cell.styles.fontStyle = 'bold';
            }
            if (h.section === 'body' && h.column.index === 7) {
                h.cell.styles.textColor = [183,28,28];
                h.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // Halaman 3: Ringkasan Bulanan (Per RTU ID + Facility Name + OPS Team + Node Type)
    doc.addPage();
    doc.setFillColor(31,56,100); doc.rect(0,0,W,10,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont(undefined,'bold');
    doc.text('RINGKASAN BULANAN PER RTU / FASILITAS', W/2, 7, { align: 'center' });

    const monthlyPdfMap = {};
    opmState.allRows.forEach(r => {
        const month = r.date ? r.date.substring(0,7) : 'Unknown';
        const rtu = r.rtu || '-';
        const facility = r.facility || '-';
        const team = r.team || '-';
        const nodeType = r.nodeType || '-';
        const key = `${month}__${rtu}__${facility}__${team}__${nodeType}`;
        if (!monthlyPdfMap[key]) {
            const paramAccepted = {};
            paramCols.forEach(pc => { paramAccepted[pc.verifCol] = 0; });
            monthlyPdfMap[key] = { month, rtu, facility, team, nodeType, totalDays: 0, accepted: 0, paramAccepted };
        }
        monthlyPdfMap[key].totalDays++;
        if (r.statusMain === 'Accepted') monthlyPdfMap[key].accepted++;
        paramCols.forEach(pc => {
            if (r.paramStatuses[pc.verifCol] === 'Accepted') monthlyPdfMap[key].paramAccepted[pc.verifCol]++;
        });
    });

    const monthlyPdfList = Object.values(monthlyPdfMap).sort((a,b) => a.month.localeCompare(b.month) || String(a.rtu).localeCompare(String(b.rtu), undefined, {numeric:true}));

    doc.autoTable({
        startY: 14,
        head: [['Bulan','RTU','Facility','Team','Node','Days','Acc','Rej','Rate', ...dailyParamHeaders]],
        body: monthlyPdfList.map(item => {
            const rejected = item.totalDays - item.accepted;
            const rate = item.totalDays ? ((item.accepted / item.totalDays) * 100).toFixed(1) + '%' : '0.0%';
            const paramVals = paramCols.map(pc => item.paramAccepted[pc.verifCol] > 0 ? String(item.paramAccepted[pc.verifCol]) : 'Rej');
            return [item.month, String(item.rtu), item.facility.substring(0,15), item.team, item.nodeType, item.totalDays, item.accepted, rejected, rate, ...paramVals];
        }),
        headStyles: { fillColor: [31,56,100], textColor: 255, fontSize: 6.5 },
        bodyStyles: { fontSize: 6 },
        didParseCell: h => {
            if (h.section === 'body' && h.column.index === 6) {
                h.cell.styles.textColor = [27,94,32];
                h.cell.styles.fontStyle = 'bold';
            }
            if (h.section === 'body' && h.column.index === 7) {
                h.cell.styles.textColor = [183,28,28];
                h.cell.styles.fontStyle = 'bold';
            }
        }
    });

    doc.save('OPM_Verification_Report.pdf');
});

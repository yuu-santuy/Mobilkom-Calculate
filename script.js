// =====================================================================
// NUFLO AVAILABILITY & BILLING DASHBOARD — PT MOBILKOM
// =====================================================================

// ---------------------- GLOBAL STATE ----------------------
const appState = {
    allData: [],
    defaultPrice: 18000,
    customPrices: {},
    ser02: 18000,
    ser04: 32000,
    ser18: 30000,
    filters: { search: '', well: 'ALL', status: 'ALL' },
    sort: { key: 'date', dir: 'asc' },
    chart: null,
    uploadMode: 'new',
    uploadHistory: []
};

const REQUIRED_COLS = ['WellName', 'Date', 'ScanTime', 'Flowrate', 'InternalTemperature', 'SupplyVoltage', 'BatteryVoltage'];
const AVAILABILITY_THRESHOLD = 90;
const MINUTES_PER_DAY = 1440;

// ---------------------- DOM SHORTCUTS ----------------------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileNameDisplay = document.getElementById('file-name-display');
const processBtn = document.getElementById('process-btn');
const uploadError = document.getElementById('upload-error');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');
const progressBar = document.getElementById('progress-bar');
const dashboardSection = document.getElementById('dashboard-section');
const tableBody = document.getElementById('table-body');

let selectedFiles = null;

// ---------------------- UPLOAD UI ----------------------
function initUploadUI() {
    const dz = document.getElementById('dropzone');
    const fi = document.getElementById('file-input');
    if (!dz || !fi) {
        console.error('[NUFLO] dropzone or file-input not found!');
        return;
    }
    dz.addEventListener('click', () => {
        fi.click();
    });
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFileSelected(Array.from(e.dataTransfer.files));
    });
    fi.addEventListener('change', (e) => {
        if (e.target.files.length) handleFileSelected(Array.from(e.target.files));
    });
    console.log('[NUFLO] Upload UI initialized');
}

// Jalankan saat DOM siap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUploadUI);
} else {
    initUploadUI();
}

function handleFileSelected(files) {
    const invalid = files.find(f => !['xls', 'xlsx', 'csv'].includes(f.name.split('.').pop().toLowerCase()));
    if (invalid) {
        showUploadError(`Format ".${invalid.name.split('.').pop()}" tidak didukung. Gunakan .xls, .xlsx, atau .csv.`);
        return;
    }
    selectedFiles = files;
    uploadError.classList.add('hidden');
    fileNameDisplay.textContent = files.length === 1
        ? `File terpilih: ${files[0].name}`
        : `${files.length} file terpilih (akan digabung otomatis)`;
    fileInfo.classList.remove('hidden');
}

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.uploadMode = btn.dataset.mode;
    });
});

function showUploadError(msg) {
    uploadError.textContent = `⚠ ${msg}`;
    uploadError.classList.remove('hidden');
}

processBtn.addEventListener('click', () => {
    if (selectedFiles) processFile(selectedFiles);
});

// ---------------------- HAMBURGER MENU (NAVIGASI HALAMAN) ----------------------
const PAGE_META = {
    nuflo: { title: 'NUFLO Availability & Billing Dashboard', subtitle: 'Monitoring Availability Sumur & Perhitungan Tagihan Otomatis' },
    pressure: { title: 'Pressure Data Dashboard', subtitle: 'Availability Data Tekanan — Perbandingan PHR vs Mobilkom' },
    ceor: { title: 'CEOR Data Dashboard', subtitle: 'Aplikasi Pengolah & Ringkasan Data CEOR' },
    opm: { title: 'OPM Verification Dashboard', subtitle: 'Accept / Reject per RTU & Parameter' }
};

document.getElementById('hamburger-btn').addEventListener('click', () => {
    document.getElementById('hamburger-menu').classList.remove('hidden');
});
document.getElementById('hamburger-overlay').addEventListener('click', closeHamburgerMenu);
function closeHamburgerMenu() {
    document.getElementById('hamburger-menu').classList.add('hidden');
}

document.querySelectorAll('.menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.getElementById('page-nuflo').classList.toggle('hidden', page !== 'nuflo');
        document.getElementById('page-pressure').classList.toggle('hidden', page !== 'pressure');
        document.getElementById('page-ceor').classList.toggle('hidden', page !== 'ceor');
        document.getElementById('page-opm').classList.toggle('hidden', page !== 'opm');

        const meta = PAGE_META[page];
        if (!meta) return;

        document.getElementById('page-header-title').textContent = meta.title;
        document.getElementById('page-header-subtitle').textContent = meta.subtitle;

        closeHamburgerMenu();
    });
});

// ---------------------- HELPER: NORMALISASI NAMA KOLOM ----------------------
function normalizeColName(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Cari nama kolom asli di dalam baris sampel, cocokkan dengan nama kolom baku — TIDAK SENSITIF
// terhadap variasi nama header (mis. "Date" vs "ScanDate" vs "LASTGOOD_SCANDATE" vs "DateStamp",
// "WELLNAME" vs "NodeID"). Mendukung format lama maupun format baru A-Q serta variasi nama lainnya.
function buildColumnMap(sampleRow) {
    const keys = Object.keys(sampleRow || {});
    const patternsByField = {
        NodeID: [
            k => normalizeColName(k) === 'wellname',
            k => normalizeColName(k) === 'nodeid',
            k => normalizeColName(k) === 'well',
            k => normalizeColName(k) === 'node',
            k => normalizeColName(k).includes('wellname'),
            k => normalizeColName(k).includes('nodeid'),
            k => normalizeColName(k).includes('well'),
            k => normalizeColName(k).includes('node')
        ],
        Date: [
            k => normalizeColName(k) === 'lastgoodscandate',
            k => normalizeColName(k) === 'scandate',
            k => normalizeColName(k) === 'date',
            k => normalizeColName(k) === 'datestamp',
            k => normalizeColName(k) === 'reportdate',
            k => normalizeColName(k).includes('scandate'),
            k => normalizeColName(k).includes('date') && !normalizeColName(k).includes('update') && !normalizeColName(k).includes('insert')
        ],
        ScanTime: [
            k => normalizeColName(k) === 'lastgoodscantime',
            k => normalizeColName(k) === 'scantime',
            k => normalizeColName(k) === 'time',
            k => normalizeColName(k) === 'timestamp',
            k => normalizeColName(k).includes('scantime'),
            k => normalizeColName(k).includes('time') && !normalizeColName(k).includes('run') && !normalizeColName(k).includes('total')
        ],
        Flowrate: [
            k => normalizeColName(k) === 'flowrate',
            k => normalizeColName(k) === 'flow',
            k => normalizeColName(k) === 'dailyflowrate',
            k => normalizeColName(k).includes('flowrate'),
            k => normalizeColName(k).includes('flow')
        ],
        InternalTemperature: [
            k => normalizeColName(k) === 'internaltempc',
            k => normalizeColName(k) === 'internaltemp',
            k => normalizeColName(k) === 'temperature',
            k => normalizeColName(k) === 'temp',
            k => normalizeColName(k).startsWith('internaltemperature'),
            k => normalizeColName(k).startsWith('internaltemp'),
            k => normalizeColName(k).includes('temperature'),
            k => normalizeColName(k).includes('temp')
        ],
        SupplyVoltage: [
            k => normalizeColName(k) === 'supplyvoltage',
            k => normalizeColName(k) === 'supplyvolt',
            k => normalizeColName(k) === 'supplyv',
            k => normalizeColName(k).startsWith('supplyvoltage'),
            k => normalizeColName(k).includes('supply') && normalizeColName(k).includes('volt')
        ],
        BatteryVoltage: [
            k => normalizeColName(k) === 'batteryvoltage',
            k => normalizeColName(k) === 'batteryvolt',
            k => normalizeColName(k) === 'batteryv',
            k => normalizeColName(k).startsWith('batteryvoltage'),
            k => normalizeColName(k).includes('battery') && normalizeColName(k).includes('volt')
        ],
        RtuId: [
            k => normalizeColName(k) === 'rtuid',
            k => normalizeColName(k) === 'rtu',
            k => normalizeColName(k).includes('rtuid'),
            k => normalizeColName(k).includes('rtu')
        ],
        Uwi: [
            k => normalizeColName(k) === 'uwi',
            k => normalizeColName(k).includes('uwi')
        ],
        CommPercent: [
            k => normalizeColName(k) === 'commpercent',
            k => normalizeColName(k) === 'commpct',
            k => normalizeColName(k) === 'availability',
            k => normalizeColName(k).includes('commpercent') || normalizeColName(k).includes('commpct')
        ],
        CommStatus: [
            k => normalizeColName(k) === 'commstatus',
            k => normalizeColName(k) === 'status',
            k => normalizeColName(k).includes('commstatus')
        ],
        ControllerType: [
            k => normalizeColName(k) === 'controllertype',
            k => normalizeColName(k) === 'controller',
            k => normalizeColName(k).includes('controllertype') || normalizeColName(k).includes('controller')
        ],
        HourlyRuntime: [
            k => normalizeColName(k) === 'hourlyruntime',
            k => normalizeColName(k) === 'runtime',
            k => normalizeColName(k).includes('hourlyruntime') || normalizeColName(k).includes('runtime')
        ],
        InsertDate: [
            k => normalizeColName(k) === 'insertdate',
            k => normalizeColName(k).includes('insertdate')
        ],
        DailyFlowRate: [
            k => normalizeColName(k) === 'dailyflowrate',
            k => normalizeColName(k) === 'dailyflow',
            k => normalizeColName(k).includes('dailyflow')
        ],
        HourlyFlowRate: [
            k => normalizeColName(k) === 'hourlyflowrate',
            k => normalizeColName(k) === 'hourlyflow',
            k => normalizeColName(k).includes('hourlyflow')
        ],
        GrandTotalRate: [
            k => normalizeColName(k) === 'grandtotalrate',
            k => normalizeColName(k) === 'grandtotal',
            k => normalizeColName(k).includes('grandtotal')
        ]
    };

    const map = {};
    for (const [field, patterns] of Object.entries(patternsByField)) {
        for (const test of patterns) {
            const found = keys.find(test);
            if (found) { map[field] = found; break; }
        }
    }
    return map;
}

// ---------------------- HELPER: PARSING TANGGAL & JAM (aman terhadap timezone) ----------------------
function excelSerialToDate(serial) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + Math.floor(serial) * 86400000);
}

function parseDateFlexible(value) {
    if (value instanceof Date) {
        return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    }
    if (typeof value === 'number') {
        return excelSerialToDate(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        let m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); // M/D/YYYY
        if (m) return new Date(Date.UTC(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10)));
        m = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/); // YYYY-MM-DD
        if (m) return new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
    }
    return null;
}

function formatDateStr(d) {
    if (!d) return 'Unknown Date';
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
}

function excelTimeToHHMM(value) {
    let fraction = null;
    if (typeof value === 'number') fraction = value;
    else if (typeof value === 'string' && /^\d{1,2}:\d{2}/.test(value.trim())) return value.trim();
    if (fraction === null) return '-';
    const totalMinutes = Math.round((fraction % 1) * MINUTES_PER_DAY);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
}

function formatRupiah(n) {
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

// ---------------------- PROSES FILE ----------------------
// Custom ultra-fast CSV parser. SheetJS mati (Too many properties to enumerate)
// pada file CSV besar (>=100k baris, >20MB). Kita parse manual sebagai Array of Arrays.
function parseCSVFast(text) {
    // Hapus BOM kalau ada
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const rows = [];
    let row = [];
    let cell = '';
    let inQuote = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
        const ch = text.charCodeAt(i);
        if (inQuote) {
            if (ch === 34) { // "
                if (text.charCodeAt(i + 1) === 34) { cell += '"'; i += 2; continue; }
                inQuote = false; i++;
            } else { cell += text[i]; i++; }
        } else {
            if (ch === 34) { inQuote = true; i++; }
            else if (ch === 44) { row.push(cell); cell = ''; i++; } // koma
            else if (ch === 10 || ch === 13) { // \n atau \r
                row.push(cell); cell = '';
                if (row.length > 0 && !(row.length === 1 && row[0] === '')) rows.push(row);
                row = [];
                if (ch === 13 && text.charCodeAt(i + 1) === 10) i += 2;
                else i++;
            } else { cell += text[i]; i++; }
        }
    }
    if (cell !== '' || row.length > 0) {
        row.push(cell);
        if (!(row.length === 1 && row[0] === '')) rows.push(row);
    }
    return rows;
}

async function processFile(files) {
    fileInfo.classList.add('hidden');
    loadingOverlay.classList.remove('hidden');

    try {
        await setLoadingStep(`Membaca ${files.length} file...`, 15);

        const usedSheetNames = [];
        const sheetDiagnostics = [];
        let rawData = [];

        for (const file of files) {
            const ext = file.name.split('.').pop().toLowerCase();
            let sample = null; // array-of-arrays
            let sheetName = file.name;

            if (ext === 'csv') {
                const text = await file.text();
                sample = parseCSVFast(text);
                // Trim header whitespace
                if (sample.length > 0) sample[0] = sample[0].map(h => h.trim());
            } else {
                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
                sheetName = workbook.SheetNames[0];
                const ws = workbook.Sheets[sheetName];
                sample = XLSX.utils.sheet_to_json(ws, {
                    header: 1,
                    defval: null,
                    blankrows: false
                });
                if (sample.length > 0 && Array.isArray(sample[0])) {
                    sample[0] = sample[0].map(h => (h === null || h === undefined) ? '' : String(h).trim());
                }
            }

            if (!sample || sample.length < 2) continue;

            const headerArray = sample[0].map(c => c === null || c === undefined ? "" : String(c).trim());

            // Buat sample object untuk deteksi kolom (hanya dari baris kedua)
            const sampleRowObj = {};
            for (let i = 0; i < headerArray.length; i++) {
                if (headerArray[i]) sampleRowObj[headerArray[i]] = sample[1] ? sample[1][i] : null;
            }

            const colMap = buildColumnMap(sampleRowObj);
            const cols = headerArray.filter(h => h);
            const sheetLabel = `${file.name} — ${ext === 'csv' ? 'CSV' : sheetName}`;
            sheetDiagnostics.push({
                name: sheetLabel,
                rowCount: sample.length - 1,
                columns: cols,
                colMap
            });

            if (colMap.NodeID !== undefined && colMap.Date !== undefined) {
                usedSheetNames.push(sheetLabel);

                const idxNodeID = headerArray.indexOf(colMap.NodeID);
                const idxDate = headerArray.indexOf(colMap.Date);
                const idxScanTime = colMap.ScanTime ? headerArray.indexOf(colMap.ScanTime) : -1;
                const idxFlowrate = colMap.Flowrate ? headerArray.indexOf(colMap.Flowrate) : -1;
                const idxTemp = colMap.InternalTemperature ? headerArray.indexOf(colMap.InternalTemperature) : -1;
                const idxSupplyV = colMap.SupplyVoltage ? headerArray.indexOf(colMap.SupplyVoltage) : -1;
                const idxBatteryV = colMap.BatteryVoltage ? headerArray.indexOf(colMap.BatteryVoltage) : -1;
                const idxRtu = colMap.RtuId ? headerArray.indexOf(colMap.RtuId) : -1;
                const idxUwi = colMap.Uwi ? headerArray.indexOf(colMap.Uwi) : -1;
                const idxCommPct = colMap.CommPercent ? headerArray.indexOf(colMap.CommPercent) : -1;
                const idxCommSt = colMap.CommStatus ? headerArray.indexOf(colMap.CommStatus) : -1;
                const idxCtrl = colMap.ControllerType ? headerArray.indexOf(colMap.ControllerType) : -1;
                const idxHourlyRT = colMap.HourlyRuntime ? headerArray.indexOf(colMap.HourlyRuntime) : -1;
                const idxInsDate = colMap.InsertDate ? headerArray.indexOf(colMap.InsertDate) : -1;
                const idxDailyFR = colMap.DailyFlowRate ? headerArray.indexOf(colMap.DailyFlowRate) : -1;
                const idxHourlyFR = colMap.HourlyFlowRate ? headerArray.indexOf(colMap.HourlyFlowRate) : -1;
                const idxGrandTR = colMap.GrandTotalRate ? headerArray.indexOf(colMap.GrandTotalRate) : -1;

                const totalRows = sample.length - 1;
                let processed = 0;

                for (let r = 1; r < sample.length; r++) {
                    const row = sample[r];
                    if (!row || row.length === 0) continue;

                    rawData.push({
                        _src: file.name, // [TAMBAHAN] asal file, dipakai untuk laporan duplikat
                        NodeID: row[idxNodeID],
                        Date: row[idxDate],
                        ScanTime: idxScanTime >= 0 ? row[idxScanTime] : null,
                        Flowrate: idxFlowrate >= 0 ? row[idxFlowrate] : null,
                        InternalTemperature: idxTemp >= 0 ? row[idxTemp] : null,
                        SupplyVoltage: idxSupplyV >= 0 ? row[idxSupplyV] : null,
                        BatteryVoltage: idxBatteryV >= 0 ? row[idxBatteryV] : null,
                        RtuId: idxRtu >= 0 ? row[idxRtu] : null,
                        Uwi: idxUwi >= 0 ? row[idxUwi] : null,
                        CommPercent: idxCommPct >= 0 ? row[idxCommPct] : null,
                        CommStatus: idxCommSt >= 0 ? row[idxCommSt] : null,
                        ControllerType: idxCtrl >= 0 ? row[idxCtrl] : null,
                        HourlyRuntime: idxHourlyRT >= 0 ? row[idxHourlyRT] : null,
                        InsertDate: idxInsDate >= 0 ? row[idxInsDate] : null,
                        DailyFlowRate: idxDailyFR >= 0 ? row[idxDailyFR] : null,
                        HourlyFlowRate: idxHourlyFR >= 0 ? row[idxHourlyFR] : null,
                        GrandTotalRate: idxGrandTR >= 0 ? row[idxGrandTR] : null
                    });
                    processed++;
                }
            }
        }

        await setLoadingStep('Mendeteksi sheet & kolom...', 35);

        if (usedSheetNames.length === 0) {
            const sheetList = sheetDiagnostics.map(s => `"${s.name}" (kolom: ${s.columns.join(', ') || '-'})`).join(' | ');
            throw new Error(`Tidak ada sheet yang punya kolom NodeID dan kolom tanggal yang dikenali (Date/ScanDate/DateStamp). Sheet yang terbaca: ${sheetList}`);
        }

        rawData = rawData.filter(r => r.NodeID !== null && r.NodeID !== '' && r.Date !== null && r.Date !== '');
        if (rawData.length === 0) throw new Error('Sheet ditemukan tapi tidak ada baris data valid (NodeID/Date kosong semua).');

        // [FIX] Deteksi & konversi NodeID scientific notation akibat artefak Excel CSV.
        // Excel mengubah nama sumur seperti "7E-36" → "7.00E-36" saat save-as CSV karena dianggap angka.
        // Regex cocokkan pola angka+E+angka, lalu konversi balik ke format nama sumur asli.
        const sciNotationConversions = {};
        rawData.forEach(r => {
            const id = String(r.NodeID).trim();
            if (/^[\d.]+[Ee][+\-]\d+$/.test(id)) {
                const upper = id.toUpperCase();
                const eIdx = upper.indexOf('E');
                const prefix = upper.slice(0, eIdx).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
                const suffix = upper.slice(eIdx); // e.g. "E-36"
                const converted = prefix + suffix;
                if (!sciNotationConversions[id]) sciNotationConversions[id] = converted;
                r.NodeID = converted;
            }
        });
        appState.sciNotationConversions = sciNotationConversions;

        // [TAMBAHAN] Buang baris duplikat (sumur + tanggal + jam scan yang sama).
        // Mencegah data terhitung dobel kalau ada 2 file yang isinya sama ikut ter-upload
        // (contoh: availability jadi 143% karena 1 hari masuk 2x). Baris pertama dipertahankan.
        // Baris tanpa ScanTime (data summary) tidak disentuh.
        const duplicateInfo = { removed: 0, byFile: {} };
        {
            const seenKeys = new Set();
            const uniqueRows = [];
            for (const r of rawData) {
                if (r.ScanTime === null || r.ScanTime === undefined || r.ScanTime === '') {
                    uniqueRows.push(r);
                    continue;
                }
                const k = `${String(r.NodeID).trim()}|${r.Date}|${r.ScanTime}`;
                if (seenKeys.has(k)) {
                    duplicateInfo.removed++;
                    duplicateInfo.byFile[r._src] = (duplicateInfo.byFile[r._src] || 0) + 1;
                    continue;
                }
                seenKeys.add(k);
                uniqueRows.push(r);
            }
            rawData = uniqueRows;
        }

        await setLoadingStep('Mengelompokkan per sumur & tanggal...', 60);
        const grouped = groupData(rawData);

        await setLoadingStep('Menghitung availability & rata-rata...', 80);
        const processedData = computeStats(grouped);

        await setLoadingStep('Menyusun laporan...', 100);

        const isFirstUpload = appState.allData.length === 0;
        const mode = isFirstUpload ? 'new' : appState.uploadMode;

        let mergeReport = null;
        if (mode === 'new') {
            appState.allData = processedData;
            mergeReport = { mode: 'new', added: processedData.length, updated: 0, skipped: 0, details: [] };
        } else {
            mergeReport = mergeIntoExistingData(processedData);
        }

        appState.sheetDiagnostics = sheetDiagnostics;
        appState.usedSheetNames = usedSheetNames;
        appState.validRowCount = rawData.length;
        appState.duplicateInfo = duplicateInfo; // [TAMBAHAN]
        const over100Count = processedData.filter(d => d.availability > 100).length; // [TAMBAHAN]
        appState.uploadHistory.push({
            fileName: files.length === 1 ? files[0].name : `${files.length} file digabung`,
            timestamp: new Date(),
            mode,
            added: mergeReport.added,
            updated: mergeReport.updated,
            skipped: mergeReport.skipped
        });

        populateWellDropdowns();
        renderDiagnosticPanel();
        renderUploadHistory();
        applyFiltersAndRender();

        loadingOverlay.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        document.getElementById('upload-mode-toggle').classList.remove('hidden');
        fileInput.value = '';
        selectedFiles = null;

        if (mode === 'append') {
            showMergeReportModal(mergeReport);
        } else {
            showToast(`✅ Data berhasil diproses: ${processedData.length} baris (sumur × tanggal).`, 'success');
        }

        // [TAMBAHAN] Peringatan duplikat & availability > 100%
        if (duplicateInfo.removed > 0) {
            showToast(`ℹ️ ${duplicateInfo.removed.toLocaleString('id-ID')} baris duplikat otomatis dibuang (detail di panel diagnostik).`, 'info');
        }
        if (over100Count > 0) {
            showToast(`⚠️ ${over100Count} data (sumur × tanggal) punya availability > 100%. Cek file sumber, kemungkinan ada baris dobel.`, 'info');
        }

    } catch (err) {
        loadingOverlay.classList.add('hidden');
        fileInfo.classList.remove('hidden');
        showUploadError(err.message);
    }
}

// Membandingkan 2 hasil hitungan (grup sumur+tanggal) apakah benar-benar identik
function isGroupIdentical(a, b) {
    return a.rowCount === b.rowCount &&
        Math.abs(a.sumFlowrate - b.sumFlowrate) < 0.0001 &&
        Math.abs(a.sumTemp - b.sumTemp) < 0.0001 &&
        Math.abs(a.sumSupplyV - b.sumSupplyV) < 0.0001 &&
        Math.abs(a.sumBatteryV - b.sumBatteryV) < 0.0001;
}

// Gabungkan hasil hitungan baru ke data yang sudah ada:
// - Tanggal baru (belum ada sebelumnya)   -> DITAMBAHKAN
// - Tanggal sudah ada & datanya identik   -> DILEWATI (skip)
// - Tanggal sudah ada & datanya beda      -> DIPERBARUI (update/replace)
function mergeIntoExistingData(newGroups) {
    const existingMap = new Map(appState.allData.map(g => [`${g.nodeID}_${g.date}`, g]));
    const details = [];
    let added = 0, updated = 0, skipped = 0;

    for (const newGroup of newGroups) {
        const key = `${newGroup.nodeID}_${newGroup.date}`;
        const existing = existingMap.get(key);

        if (!existing) {
            existingMap.set(key, newGroup);
            added++;
            details.push({ type: 'added', nodeID: newGroup.nodeID, date: newGroup.date, info: `${newGroup.rowCount} baris` });
        } else if (isGroupIdentical(existing, newGroup)) {
            skipped++;
            details.push({ type: 'skipped', nodeID: newGroup.nodeID, date: newGroup.date, info: `${existing.rowCount} baris (sama persis, tidak dihitung ulang)` });
        } else {
            existingMap.set(key, newGroup);
            updated++;
            details.push({ type: 'updated', nodeID: newGroup.nodeID, date: newGroup.date, info: `${existing.rowCount} baris → ${newGroup.rowCount} baris` });
        }
    }

    appState.allData = Array.from(existingMap.values()).sort((a, b) => a.nodeID.localeCompare(b.nodeID) || a.date.localeCompare(b.date));
    return { mode: 'append', added, updated, skipped, details };
}

function setLoadingStep(message, percent) {
    loadingMessage.textContent = message;
    progressBar.style.width = percent + '%';
    return new Promise(resolve => setTimeout(resolve, 220));
}

function groupData(rawData) {
    const grouped = {};
    for (const row of rawData) {
        const nodeID = String(row.NodeID).trim();
        const dateObj = parseDateFlexible(row.Date);
        const dateStr = formatDateStr(dateObj);
        const key = `${nodeID}_${dateStr}`;

        if (!grouped[key]) {
            grouped[key] = {
                nodeID, date: dateStr, rowCount: 0,
                rtuId: row.RtuId || '',
                uwi: row.Uwi || '',
                controllerType: row.ControllerType || '',
                commPercentSum: 0,
                commPercentCount: 0,
                sumFlowrate: 0, sumTemp: 0, sumSupplyV: 0, sumBatteryV: 0,
                sumDailyFlowRate: 0, sumHourlyFlowRate: 0, sumGrandTotalRate: 0, sumHourlyRuntime: 0,
                rawRows: []
            };
        }
        const g = grouped[key];
        g.rowCount++;
        if (row.RtuId && !g.rtuId) g.rtuId = row.RtuId;
        if (row.Uwi && !g.uwi) g.uwi = row.Uwi;
        if (row.ControllerType && !g.controllerType) g.controllerType = row.ControllerType;

        if (row.CommPercent !== null && row.CommPercent !== undefined && !isNaN(parseFloat(row.CommPercent))) {
            g.commPercentSum += parseFloat(row.CommPercent);
            g.commPercentCount++;
        }

        g.sumFlowrate += parseFloat(row.Flowrate) || 0;
        g.sumTemp += parseFloat(row.InternalTemperature) || 0;
        g.sumSupplyV += parseFloat(row.SupplyVoltage) || 0;
        g.sumBatteryV += parseFloat(row.BatteryVoltage) || 0;
        g.sumDailyFlowRate += parseFloat(row.DailyFlowRate) || 0;
        g.sumHourlyFlowRate += parseFloat(row.HourlyFlowRate) || 0;
        g.sumGrandTotalRate += parseFloat(row.GrandTotalRate) || 0;
        g.sumHourlyRuntime += parseFloat(row.HourlyRuntime) || 0;

        g.rawRows.push({
            jam: excelTimeToHHMM(row.ScanTime),
            flowrate: row.Flowrate,
            temp: row.InternalTemperature,
            supplyV: row.SupplyVoltage,
            batteryV: row.BatteryVoltage,
            uwi: row.Uwi,
            rtuId: row.RtuId,
            commPercent: row.CommPercent,
            commStatus: row.CommStatus,
            controllerType: row.ControllerType,
            hourlyRuntime: row.HourlyRuntime,
            insertDate: row.InsertDate,
            dailyFlowRate: row.DailyFlowRate,
            hourlyFlowRate: row.HourlyFlowRate,
            grandTotalRate: row.GrandTotalRate
        });
    }
    return grouped;
}

function computeStats(grouped) {
    return Object.values(grouped).map(g => {
        // Availability: Baris per 1440 menit (atau rata-rata COMM_PERCENT jika rowCount == 1 dan COMM_PERCENT tersedia)
        let availability = (g.rowCount / MINUTES_PER_DAY) * 100;
        if (g.rowCount === 1 && g.commPercentCount === 1) {
            // Jika file input adalah data summary harian per sumur (1 baris/hari/sumur)
            availability = g.commPercentSum;
        }

        const status = availability >= AVAILABILITY_THRESHOLD ? 1 : 0;
        return {
            nodeID: g.nodeID,
            date: g.date,
            rtuId: g.rtuId || '',
            uwi: g.uwi || '',
            controllerType: g.controllerType || '',
            rowCount: g.rowCount,
            availability,
            status,
            avgFlowrate: g.sumFlowrate / g.rowCount,
            avgTemp: g.sumTemp / g.rowCount,
            avgSupplyV: g.sumSupplyV / g.rowCount,
            avgBatteryV: g.sumBatteryV / g.rowCount,
            avgDailyFlowRate: g.sumDailyFlowRate / g.rowCount,
            avgHourlyFlowRate: g.sumHourlyFlowRate / g.rowCount,
            avgGrandTotalRate: g.sumGrandTotalRate / g.rowCount,
            avgHourlyRuntime: g.sumHourlyRuntime / g.rowCount,
            sumFlowrate: g.sumFlowrate,
            sumTemp: g.sumTemp,
            sumSupplyV: g.sumSupplyV,
            sumBatteryV: g.sumBatteryV,
            rawRows: g.rawRows
        };
    }).sort((a, b) => a.nodeID.localeCompare(b.nodeID) || a.date.localeCompare(b.date));
}

// ---------------------- HARGA ----------------------
function getPriceForWell(nodeID) {
    return appState.customPrices[nodeID] ?? appState.defaultPrice;
}

function getBilling(row) {
    return row.status === 1 ? getPriceForWell(row.nodeID) : 0;
}

// ---------------------- DIAGNOSTIC PANEL ----------------------
function renderDiagnosticPanel() {
    const body = document.getElementById('diagnostic-body');
    const { sheetDiagnostics, usedSheetNames, validRowCount } = appState;
    let html = `<p>File kamu punya <b>${sheetDiagnostics.length}</b> sheet. Sheet yang digabung untuk perhitungan: <b>${usedSheetNames.map(n => `"${n}"`).join(', ')}</b>.</p>`;

    sheetDiagnostics.forEach(s => {
        const isUsed = usedSheetNames.includes(s.name);
        html += `<h4 style="margin-top:0.9rem;">${isUsed ? '✅ Dipakai' : '⏭️ Dilewati'} — Sheet "${s.name}" (${s.rowCount} baris terbaca)</h4>`;
        html += `<table><thead><tr><th>Kolom dibutuhkan</th><th>Status</th></tr></thead><tbody>`;
        REQUIRED_COLS.forEach(col => {
            const found = !!s.colMap[col];
            html += `<tr><td><code>${col}</code></td><td class="${found ? 'tag-ok' : 'tag-miss'}">${found ? 'Ditemukan (' + s.colMap[col] + ')' : 'Tidak ada'}</td></tr>`;
        });
        html += `</tbody></table>`;
    });

    html += `<p><b>Total baris valid dipakai:</b> ${validRowCount} baris.</p>`;

    // [TAMBAHAN] Info baris duplikat yang dibuang
    const dup = appState.duplicateInfo;
    if (dup && dup.removed > 0) {
        const fileList = Object.entries(dup.byFile).map(([f, n]) => `"${f}" (${n.toLocaleString('id-ID')} baris)`).join(', ');
        html += `<p style="color:#b45309;"><b>⚠️ ${dup.removed.toLocaleString('id-ID')} baris duplikat dibuang</b> (sumur + tanggal + jam scan sama dengan baris dari file lain/sebelumnya). File yang berisi duplikat: ${fileList}.</p>`;
    }

    // [FIX 1] Info konversi scientific notation NodeID
    const sci = appState.sciNotationConversions || {};
    const sciEntries = Object.entries(sci);
    if (sciEntries.length > 0) {
        const list = sciEntries.map(([raw, fixed]) => `<code>${raw}</code> → <code>${fixed}</code>`).join(', ');
        html += `<p style="color:#0369a1;"><b>ℹ️ ${sciEntries.length} NodeID dikonversi dari scientific notation (artefak Excel CSV):</b> ${list}.</p>`;
    }

    body.innerHTML = html;
}

document.getElementById('diagnostic-toggle').addEventListener('click', () => {
    const body = document.getElementById('diagnostic-body');
    const arrow = document.getElementById('diagnostic-arrow');
    body.classList.toggle('hidden');
    arrow.textContent = body.classList.contains('hidden') ? '▼' : '▲';
});

// ---------------------- TOAST NOTIFICATION ----------------------
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ---------------------- MODAL LAPORAN PENGGABUNGAN ----------------------
function showMergeReportModal(report) {
    const body = document.getElementById('merge-modal-body');
    const iconFor = t => t === 'added' ? '🟢' : t === 'updated' ? '🟡' : '⚪';
    const labelFor = t => t === 'added' ? 'Ditambahkan (tanggal baru)' : t === 'updated' ? 'Diperbarui (data berubah)' : 'Dilewati (sudah sama persis)';

    let html = `
        <div class="merge-summary-grid">
            <div class="merge-summary-item merge-added"><h2>${report.added}</h2><p>Ditambahkan</p></div>
            <div class="merge-summary-item merge-updated"><h2>${report.updated}</h2><p>Diperbarui</p></div>
            <div class="merge-summary-item merge-skipped"><h2>${report.skipped}</h2><p>Dilewati</p></div>
        </div>
        <p class="merge-explain">Data lama tetap aman. Sistem hanya menambah tanggal baru, memperbarui tanggal yang datanya berubah, dan melewati tanggal yang sudah persis sama — tidak ada yang dihitung dua kali.</p>
    `;

    if (report.details.length > 0) {
        html += `<div class="verify-table-wrap"><table>
            <thead><tr><th>Status</th><th>Nama Sumur</th><th>Tanggal</th><th>Keterangan</th></tr></thead>
            <tbody>${report.details.map(d => `
                <tr>
                    <td>${iconFor(d.type)} ${labelFor(d.type)}</td>
                    <td>${d.nodeID}</td>
                    <td>${d.date}</td>
                    <td>${d.info}</td>
                </tr>
            `).join('')}</tbody>
        </table></div>`;
    }

    body.innerHTML = html;
    document.getElementById('merge-modal').classList.remove('hidden');
}
document.getElementById('merge-modal-close').addEventListener('click', () => document.getElementById('merge-modal').classList.add('hidden'));
document.getElementById('merge-modal').addEventListener('click', (e) => {
    if (e.target.id === 'merge-modal') e.target.classList.add('hidden');
});

// ---------------------- RIWAYAT UPLOAD ----------------------
function renderUploadHistory() {
    const panel = document.getElementById('upload-history-panel');
    const body = document.getElementById('history-body');
    if (appState.uploadHistory.length === 0) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');

    body.innerHTML = `<table><thead><tr><th>Waktu</th><th>Nama File</th><th>Mode</th><th>Ditambah</th><th>Diperbarui</th><th>Dilewati</th></tr></thead><tbody>
        ${appState.uploadHistory.map(h => `
            <tr>
                <td>${h.timestamp.toLocaleTimeString('id-ID')}</td>
                <td>${h.fileName}</td>
                <td>${h.mode === 'new' ? '🆕 Upload Baru' : '➕ Tambah Data'}</td>
                <td>${h.added}</td><td>${h.updated}</td><td>${h.skipped}</td>
            </tr>
        `).join('')}
    </tbody></table>`;
}
document.getElementById('history-toggle').addEventListener('click', () => {
    const body = document.getElementById('history-body');
    const arrow = document.getElementById('history-arrow');
    body.classList.toggle('hidden');
    arrow.textContent = body.classList.contains('hidden') ? '▼' : '▲';
});

// ---------------------- DROPDOWN SUMUR ----------------------
function populateWellDropdowns() {
    const wells = [...new Set(appState.allData.map(r => r.nodeID))].sort();

    const filterSelect = document.getElementById('well-filter-select');
    filterSelect.innerHTML = '<option value="ALL">Semua Sumur</option>' + wells.map(w => `<option value="${w}">${w}</option>`).join('');

    const priceSelect = document.getElementById('price-well-select');
    priceSelect.innerHTML = wells.map(w => `<option value="${w}">${w}</option>`).join('');
}

// ---------------------- FILTER BAR EVENTS ----------------------
document.getElementById('search-input').addEventListener('input', (e) => {
    appState.filters.search = e.target.value.trim().toLowerCase();
    applyFiltersAndRender();
});
document.getElementById('well-filter-select').addEventListener('change', (e) => {
    appState.filters.well = e.target.value;
    applyFiltersAndRender();
});
document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.filters.status = btn.dataset.status;
        applyFiltersAndRender();
    });
});
document.getElementById('reset-filter-btn').addEventListener('click', () => {
    appState.filters = { search: '', well: 'ALL', status: 'ALL' };
    document.getElementById('search-input').value = '';
    document.getElementById('well-filter-select').value = 'ALL';
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.status-btn[data-status="ALL"]').classList.add('active');
    applyFiltersAndRender();
});

function getFilteredData() {
    const { search, well, status } = appState.filters;
    return appState.allData.filter(row => {
        if (well !== 'ALL' && row.nodeID !== well) return false;
        if (status !== 'ALL' && String(row.status) !== status) return false;
        if (search) {
            const hay = (row.nodeID + ' ' + row.date).toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });
}

function applyFiltersAndRender() {
    const filtered = getFilteredData();
    renderSummaryCards(filtered);
    renderTable(sortData(filtered));
    renderChart(filtered);
    renderInvoiceSummary();
}

// ---------------------- SORTING ----------------------
document.querySelectorAll('#main-table thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (appState.sort.key === key) {
            appState.sort.dir = appState.sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            appState.sort.key = key;
            appState.sort.dir = 'asc';
        }
        applyFiltersAndRender();
    });
});

function sortData(data) {
    const { key, dir } = appState.sort;
    const factor = dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
        let av = key === 'billing' ? getBilling(a) : a[key];
        let bv = key === 'billing' ? getBilling(b) : b[key];
        if (typeof av === 'string') return av.localeCompare(bv) * factor;
        return (av - bv) * factor;
    });
}

// ---------------------- SUMMARY CARDS ----------------------
function renderSummaryCards(data) {
    const wells = new Set(data.map(r => r.nodeID));
    const avgAvail = data.length ? data.reduce((s, r) => s + r.availability, 0) / data.length : 0;
    const green = data.filter(r => r.status === 1).length;
    const red = data.filter(r => r.status === 0).length;
    const totalBilling = data.reduce((s, r) => s + getBilling(r), 0);

    document.getElementById('sum-total-wells').textContent = wells.size;
    document.getElementById('sum-avg-availability').textContent = avgAvail.toFixed(2) + '%';
    document.getElementById('sum-status-green').textContent = green;
    document.getElementById('sum-status-red').textContent = red;
    document.getElementById('sum-total-billing').textContent = formatRupiah(totalBilling);
}

// ---------------------- TABLE ----------------------
function renderTable(data) {
    tableBody.innerHTML = '';
    const emptyMsg = document.getElementById('table-empty-msg');

    if (data.length === 0) {
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');

    data.forEach((row) => {
        const tr = document.createElement('tr');
        tr.className = row.status === 1 ? 'status-green' : 'status-red';
        const billing = getBilling(row);
        const badge = row.status === 1
            ? '<span class="status-badge status-badge-green">🟢 HIJAU</span>'
            : '<span class="status-badge status-badge-red">🔴 MERAH</span>';

        tr.innerHTML = `
            <td><div style="font-weight:bold">${row.nodeID}</div></td>
            <td>${row.uwi || '-'}</td>
            <td>${row.rtuId || '-'}</td>
            <td>${row.controllerType || '-'}</td>
            <td>${row.date}</td>
            <td>${row.rowCount}</td>
            <td>${row.availability.toFixed(2)}%</td>
            <td>${badge}</td>
            <td>${(row.avgFlowrate || 0).toFixed(2)}</td>
            <td>${(row.avgDailyFlowRate || 0).toFixed(2)}</td>
            <td>${(row.avgHourlyFlowRate || 0).toFixed(2)}</td>
            <td>${(row.avgGrandTotalRate || 0).toFixed(2)}</td>
            <td>${(row.avgHourlyRuntime || 0).toFixed(2)}</td>
            <td>${(row.avgTemp || 0).toFixed(2)}</td>
            <td>${(row.avgSupplyV || 0).toFixed(2)}</td>
            <td>${(row.avgBatteryV || 0).toFixed(2)}</td>
            <td>${formatRupiah(billing)}</td>
            <td><button class="btn-verify" data-node="${row.nodeID}" data-date="${row.date}">Cek Manual</button></td>
        `;
        tableBody.appendChild(tr);
    });

    tableBody.querySelectorAll('.btn-verify').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = appState.allData.find(r => r.nodeID === btn.dataset.node && r.date === btn.dataset.date);
            openVerifyModal(row);
        });
    });
}

// ---------------------- CHART ----------------------
function renderChart(data) {
    const ctx = document.getElementById('availability-chart').getContext('2d');
    const title = document.getElementById('chart-title');
    if (appState.chart) appState.chart.destroy();

    const wellFilter = appState.filters.well;

    if (wellFilter !== 'ALL') {
        // Line chart trend per tanggal untuk 1 sumur
        title.textContent = `📈 Trend Availability Harian — ${wellFilter}`;
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const gradient = ctx.createLinearGradient(0, 0, 0, 320);
        gradient.addColorStop(0, 'rgba(10,44,92,0.35)');
        gradient.addColorStop(1, 'rgba(10,44,92,0.02)');

        appState.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sorted.map(r => r.date),
                datasets: [{
                    label: 'Availability (%)',
                    data: sorted.map(r => r.availability),
                    borderColor: '#0a2c5c',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: sorted.map(r => r.status === 1 ? '#2e7d32' : '#c62828'),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 3
                }, {
                    label: 'Batas Minimum (90%)',
                    data: sorted.map(() => 90),
                    borderColor: '#d4a017',
                    borderDash: [8, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.dataset.label === 'Availability (%)'
                                ? `Availability: ${ctx.parsed.y.toFixed(2)}%`
                                : 'Batas minimum: 90%'
                        }
                    }
                },
                scales: { y: { min: 0, max: 105, ticks: { callback: v => v + '%' } } }
            }
        });
    } else {
        // Bar chart perbandingan rata-rata availability antar sumur
        title.textContent = '📊 Perbandingan Rata-rata Availability antar Sumur';
        const wellMap = {};
        data.forEach(r => {
            if (!wellMap[r.nodeID]) wellMap[r.nodeID] = [];
            wellMap[r.nodeID].push(r.availability);
        });
        const wells = Object.keys(wellMap).sort();
        const avgs = wells.map(w => wellMap[w].reduce((a, b) => a + b, 0) / wellMap[w].length);

        appState.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: wells,
                datasets: [{
                    label: 'Rata-rata Availability (%)',
                    data: avgs,
                    backgroundColor: avgs.map(v => v >= 90 ? 'rgba(46,125,50,0.75)' : 'rgba(198,40,40,0.75)'),
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(2)}%` } }
                },
                scales: { y: { min: 0, max: 105, ticks: { callback: v => v + '%' } } }
            }
        });
    }
}

// ---------------------- VERIFY MODAL ----------------------
function openVerifyModal(row) {
    document.getElementById('verify-title').textContent = `Verifikasi Manual — ${row.nodeID} / ${row.date}`;
    const billing = getBilling(row);
    const price = getPriceForWell(row.nodeID);

    const previewRows = row.rawRows.slice(0, 15);
    const tableRowsHtml = previewRows.map((r, idx) => `
        <tr>
            <td>${idx + 1}</td><td>${r.jam}</td>
            <td>${r.flowrate ?? '-'}</td><td>${r.temp ?? '-'}</td>
            <td>${r.supplyV ?? '-'}</td><td>${r.batteryV ?? '-'}</td>
            <td>${r.hourlyRuntime ?? '-'}</td><td>${r.dailyFlowRate ?? '-'}</td>
        </tr>
    `).join('');

    document.getElementById('verify-body').innerHTML = `
        <div class="verify-grid-info">
            <div class="verify-formula"><b>Sumur:</b> ${row.nodeID}</div>
            <div class="verify-formula"><b>UWI:</b> ${row.uwi || '-'}</div>
            <div class="verify-formula"><b>RTU ID:</b> ${row.rtuId || '-'}</div>
            <div class="verify-formula"><b>Controller:</b> ${row.controllerType || '-'}</div>
        </div>
        <div class="verify-formula"><b>Availability</b>
            <code>(${row.rowCount} / 1440) × 100 = ${row.availability.toFixed(4)}%</code>
        </div>
        <div class="verify-formula"><b>Status</b>
            <code>${row.availability.toFixed(2)}% ${row.status === 1 ? '≥' : '<'} 90% → Status ${row.status} (${row.status === 1 ? 'Bisa Ditagih' : 'Belum Bisa Ditagih'})</code>
        </div>
        <div class="verify-formula"><b>Rata-rata</b>
            <code>Flowrate = ${row.sumFlowrate.toFixed(2)} / ${row.rowCount} = ${row.avgFlowrate.toFixed(4)}
Temp     = ${row.sumTemp.toFixed(2)} / ${row.rowCount} = ${row.avgTemp.toFixed(4)}
SupplyV  = ${row.sumSupplyV.toFixed(2)} / ${row.rowCount} = ${row.avgSupplyV.toFixed(4)}
BatteryV = ${row.sumBatteryV.toFixed(2)} / ${row.rowCount} = ${row.avgBatteryV.toFixed(4)}</code>
        </div>
        <div class="verify-formula"><b>Tagihan</b>
            <code>Harga/hari = ${formatRupiah(price)} → Tagihan = ${formatRupiah(billing)}</code>
        </div>
        <p><b>Contoh ${previewRows.length} dari ${row.rowCount} baris mentah:</b></p>
        <div class="verify-table-wrap">
            <table><thead><tr><th>#</th><th>Jam</th><th>Flowrate</th><th>Temp</th><th>SupplyV</th><th>BatteryV</th><th>Hourly Runtime</th><th>Daily Flowrate</th></tr></thead>
            <tbody>${tableRowsHtml}</tbody></table>
        </div>
    `;
    document.getElementById('verify-modal').classList.remove('hidden');
}
document.getElementById('verify-close').addEventListener('click', () => document.getElementById('verify-modal').classList.add('hidden'));
document.getElementById('verify-modal').addEventListener('click', (e) => {
    if (e.target.id === 'verify-modal') e.target.classList.add('hidden');
});

// ---------------------- PANEL HARGA ----------------------
document.getElementById('default-price-input').addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
        appState.defaultPrice = val;
        applyFiltersAndRender();
    }
});

document.getElementById('apply-custom-price-btn').addEventListener('click', () => {
    const well = document.getElementById('price-well-select').value;
    const priceInput = document.getElementById('custom-price-input');
    const val = parseFloat(priceInput.value);
    if (!well || isNaN(val) || val < 0) return;
    appState.customPrices[well] = val;
    priceInput.value = '';
    renderCustomPriceChips();
    applyFiltersAndRender();
});

function renderCustomPriceChips() {
    const container = document.getElementById('custom-price-list');
    const entries = Object.entries(appState.customPrices);
    container.innerHTML = entries.map(([well, price]) => `
        <span class="price-chip">${well}: ${formatRupiah(price)} <button data-well="${well}">&times;</button></span>
    `).join('');
    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            delete appState.customPrices[btn.dataset.well];
            renderCustomPriceChips();
            applyFiltersAndRender();
        });
    });
}

// ---------------------- RINGKASAN TAGIHAN PER SUMUR ----------------------
function renderInvoiceSummary() {
    const wells = [...new Set(appState.allData.map(r => r.nodeID))].sort();
    const tbody = document.getElementById('invoice-table-body');
    const tfoot = document.getElementById('invoice-table-foot');

    let grandTotalDays = 0, grandGreen = 0, grandRed = 0, grandBilling = 0;

    tbody.innerHTML = wells.map((well, idx) => {
        const rows = appState.allData.filter(r => r.nodeID === well);
        const totalDays = rows.length;
        const greenDays = rows.filter(r => r.status === 1).length;
        const redDays = totalDays - greenDays;
        const price = getPriceForWell(well);
        const totalBilling = greenDays * price;

        grandTotalDays += totalDays; grandGreen += greenDays; grandRed += redDays; grandBilling += totalBilling;

        return `<tr>
            <td>${idx + 1}</td><td>${well}</td><td>${totalDays}</td>
            <td>${greenDays}</td><td>${redDays}</td>
            <td>${formatRupiah(price)}</td><td>${formatRupiah(totalBilling)}</td>
        </tr>`;
    }).join('');

    tfoot.innerHTML = `<tr>
        <td colspan="2">GRAND TOTAL</td><td>${grandTotalDays}</td>
        <td>${grandGreen}</td><td>${grandRed}</td><td>-</td><td>${formatRupiah(grandBilling)}</td>
    </tr>`;
}

// ---------------------- HELPER: BACA INPUT KONTRAK ----------------------
function getContractInfo() {
    return {
        contractNo: document.getElementById('input-contract-no')?.value || 'SPHR00334A',
        docNo: document.getElementById('input-doc-no')?.value || '',
        contractTitle: document.getElementById('input-contract-title')?.value || '',
        requestOrder: document.getElementById('input-request-order')?.value || '',
        reportTitle: document.getElementById('input-report-title')?.value || '',
        periode: document.getElementById('input-periode')?.value || '',
        startDate: document.getElementById('input-start-date')?.value || '',
        endDate: document.getElementById('input-end-date')?.value || '',
        ser02: parseFloat(document.getElementById('input-ser02')?.value) || 18000,
        ser04: parseFloat(document.getElementById('input-ser04')?.value) || 32000,
        ser18: parseFloat(document.getElementById('input-ser18')?.value) || 30000,
    };
}

// ---------------------- AMBIL LOGO SEBAGAI BASE64 ----------------------
async function fetchLogoBase64(filename) {
    try {
        const res = await fetch(filename);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    } catch (e) {
        return null;
    }
}


// ---------------------- EXPORT EXCEL — format persis seperti laporan Billable asli ----------------------
document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);

async function exportToExcel() {
    if (appState.allData.length === 0) { alert('Tidak ada data untuk di-export.'); return; }
    const ci = getContractInfo();
    const totalPerWellPerDay = ci.ser02 + ci.ser04 + ci.ser18;

    // --- LOGIKA START/END DATE ---
    // Prioritas: 1) Input user (format bebas DD-MMM-YY, YYYY-MM-DD, dll)
    //            2) Auto dari data mentah (format YYYY-MM-DD) -> konversi ke DD-MMM-YY
    let displayStart = ci.startDate && ci.startDate.trim() ? ci.startDate.trim() : '';
    let displayEnd = ci.endDate && ci.endDate.trim() ? ci.endDate.trim() : '';

    // Jika user KOSONGKAN input, hitung otomatis dari data (format YYYY-MM-DD -> DD-MMM-YY)
    if (!displayStart || !displayEnd) {
        const dates = appState.allData
            .map(r => r.date)
            .filter(d => d && d !== 'Unknown Date')
            .sort();
        if (dates.length > 0) {
            function toDDMMMYY(iso) {
                if (!iso) return '';
                const d = new Date(iso + 'T00:00:00Z');
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return `${String(d.getUTCDate()).padStart(2,'0')}-${months[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(-2)}`;
            }
            if (!displayStart) displayStart = toDDMMMYY(dates[0]);
            if (!displayEnd) displayEnd = toDDMMMYY(dates[dates.length - 1]);
        }
    }

    // Ambil logo (base64)
    const [mobilkomB64, phrB64] = await Promise.all([
        fetchLogoBase64('logo_mobilkom.jpg'),
        fetchLogoBase64('logo_phr.png')
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT Mobilkom Telekomindo';

    const NAVY = 'FF1F3864';
    const WHITE = 'FFFFFFFF';
    const HEADER_BG = 'FF1F3864';

    // ============ SHEET 1: BILLABLE ============
    const ws1 = workbook.addWorksheet('Billable WIW Online Monitoring');

    // Kolom widths
    ws1.getColumn(1).width = 5;
    ws1.getColumn(2).width = 16;
    ws1.getColumn(3).width = 10;
    ws1.getColumn(4).width = 8;
    ws1.getColumn(5).width = 8;
    [6,7,8,9].forEach(c => ws1.getColumn(c).width = 14);
    ws1.getColumn(10).width = 18;
    [11,12,13,14].forEach(c => ws1.getColumn(c).width = 5);

    // --- Row 1: Logo Mobilkom + Judul + Logo PHR ---
    ws1.getRow(1).height = 58;
    ws1.mergeCells('A1:B1');
    ws1.mergeCells('C1:M1');
    ws1.mergeCells('N1:O1');
    ws1.getCell('C1').value = `MONTHLY SUMMARY DATA REPORT\nWIW ONLINE MONITORING ${ci.reportTitle}`;
    ws1.getCell('C1').font = { bold: true, size: 14 };
    ws1.getCell('C1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    if (mobilkomB64) {
        const mobilkomImageId = workbook.addImage({ base64: mobilkomB64, extension: 'jpeg' });
        ws1.addImage(mobilkomImageId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 1 } });
    }
    if (phrB64) {
        const phrImageId = workbook.addImage({ base64: phrB64, extension: 'png' });
        ws1.addImage(phrImageId, { tl: { col: 13, row: 0 }, br: { col: 15, row: 1 } });
    }

    // --- Rows 2-4: Info kontrak ---
    ws1.getCell('A2').value = 'Contract'; ws1.getCell('A2').font = { bold: true };
    ws1.getCell('C2').value = `: ${ci.contractNo}`;
    ws1.getCell('J2').value = 'Document No. :'; ws1.getCell('J2').font = { bold: true };
    ws1.mergeCells('K2:N2'); ws1.getCell('K2').value = ci.docNo;

    ws1.getCell('A3').value = 'Contract Title'; ws1.getCell('A3').font = { bold: true };
    ws1.mergeCells('C3:I3'); ws1.getCell('C3').value = `: ${ci.contractTitle}`;
    ws1.getCell('J3').value = 'Start :'; ws1.getCell('J3').font = { bold: true };
    ws1.mergeCells('K3:N3'); ws1.getCell('K3').value = displayStart;
    ws1.getRow(3).height = 30;

    ws1.getCell('A4').value = 'Request Order'; ws1.getCell('A4').font = { bold: true };
    ws1.mergeCells('C4:D4'); ws1.getCell('C4').value = `: ${ci.requestOrder}`;
    ws1.getCell('J4').value = 'End :'; ws1.getCell('J4').font = { bold: true };
    ws1.mergeCells('K4:N4'); ws1.getCell('K4').value = displayEnd;

    ws1.getRow(5).height = 6;

    // --- Row 6: Header tabel ---
    const h6 = ws1.getRow(6);
    const hdrValues = ['No', 'Location Name', 'RTU Tipe', 'RTU ID', '#Data', 'SER-02 (IDR)', 'SER-04 (IDR)', 'SER-18 (IDR)', 'Total (IDR)', 'Grand Total (IDR)'];
    hdrValues.forEach((v, i) => {
        const cell = h6.getCell(i + 1);
        cell.value = v;
        cell.font = { bold: true, color: { argb: WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    ws1.mergeCells('J6:N6');
    ws1.getRow(6).height = 28;

    // --- Rows 7+: Data per sumur ---
    const wells = [...new Set(appState.allData.map(r => r.nodeID))].sort();
    let rowIdx = 7;
    let totalDataCount = 0;

    wells.forEach((well, i) => {
        const wellRows = appState.allData.filter(r => r.nodeID === well);
        const greenDays = wellRows.filter(r => r.status === 1).length;
        if (greenDays === 0) return;

        const rtuId = wellRows[0]?.rtuId || '';
        const grandTotal = greenDays * totalPerWellPerDay;
        totalDataCount += greenDays;

        const r = ws1.getRow(rowIdx);
        r.values = [i + 1, well, 'OPM', rtuId, greenDays, ci.ser02, ci.ser04, ci.ser18, totalPerWellPerDay, grandTotal];
        r.getCell(6).numFmt = '#,##0.00'; r.getCell(7).numFmt = '#,##0.00';
        r.getCell(8).numFmt = '#,##0.00'; r.getCell(9).numFmt = '#,##0.00';
        r.getCell(10).numFmt = '#,##0.00';

        ws1.mergeCells(`J${rowIdx}:N${rowIdx}`);
        r.eachCell(cell => {
            cell.border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
        });
        rowIdx++;
    });

    // --- Grand Total row ---
    const grandTotalRow = ws1.getRow(rowIdx);
    const totalGrandTotal = totalDataCount * totalPerWellPerDay;
    grandTotalRow.values = ['', '', '', '', totalDataCount, ci.ser02 * totalDataCount, ci.ser04 * totalDataCount, ci.ser18 * totalDataCount, 'Grand Total', totalGrandTotal];
    ws1.mergeCells(`I${rowIdx}:I${rowIdx}`);
    ws1.mergeCells(`J${rowIdx}:N${rowIdx}`);
    grandTotalRow.getCell(9).value = 'Grand Total'; grandTotalRow.getCell(9).font = { bold: true };
    grandTotalRow.getCell(10).value = totalGrandTotal; grandTotalRow.getCell(10).numFmt = '#,##0.00';
    grandTotalRow.eachCell(cell => { cell.font = { ...(cell.font || {}), bold: true }; });
    rowIdx++;

    // --- Breakdown per Service Code ---
    rowIdx++;
    const scHeaderRow = ws1.getRow(rowIdx);
    ['', 'Service Code', 'Description', '', '', '', '', '', 'Service Rate (IDR)', '#Data', 'Grand Total (IDR)'].forEach((v, i) => {
        scHeaderRow.getCell(i + 1).value = v;
        if (v) { scHeaderRow.getCell(i + 1).font = { bold: true }; scHeaderRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }; }
    });
    ws1.mergeCells(`C${rowIdx}:H${rowIdx}`);
    ws1.mergeCells(`K${rowIdx}:N${rowIdx}`);
    rowIdx++;

    const services = [
        { code: 'SER-02', desc: 'On-Off Well or RTU Data Remote (Non-Duri, Kulin)', rate: ci.ser02 },
        { code: 'SER-04', desc: 'Optional remote power, including Solar panel, battery back up and installation mounting (Non Duri, Kulin)', rate: ci.ser04 },
        { code: 'SER-18', desc: 'Optional data from Open channel flow sensor (Non Duri, Kulin)', rate: ci.ser18 },
    ];
    services.forEach(s => {
        const r = ws1.getRow(rowIdx);
        r.getCell(2).value = s.code;
        r.getCell(3).value = s.desc;
        r.getCell(9).value = s.rate; r.getCell(9).numFmt = '#,##0';
        r.getCell(10).value = totalDataCount;
        r.getCell(11).value = s.rate * totalDataCount; r.getCell(11).numFmt = '#,##0';
        ws1.mergeCells(`C${rowIdx}:H${rowIdx}`);
        ws1.mergeCells(`K${rowIdx}:N${rowIdx}`);
        rowIdx++;
    });
    const totalAllServices = (ci.ser02 + ci.ser04 + ci.ser18) * totalDataCount;
    ws1.getCell(`J${rowIdx}`).value = 'Grand Total';
    ws1.getCell(`J${rowIdx}`).font = { bold: true };
    ws1.getCell(`K${rowIdx}`).value = totalAllServices;
    ws1.getCell(`K${rowIdx}`).numFmt = '#,##0';
    ws1.getCell(`K${rowIdx}`).font = { bold: true };
    ws1.mergeCells(`K${rowIdx}:N${rowIdx}`);
    rowIdx += 2;

    // ACCEPTANCE row
    ws1.mergeCells(`A${rowIdx}:N${rowIdx}`);
    ws1.getCell(`A${rowIdx}`).value = 'ACCEPTANCE';
    ws1.getCell(`A${rowIdx}`).font = { bold: true };
    ws1.getCell(`A${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    rowIdx++;

    // ============ SHEET 2: DETAIL HARIAN (LENGKAP 17 KOLOM A-Q) ============
    const ws2 = workbook.addWorksheet('Detail Harian');
    const totalCols = 17;
    const lastColLetter = 'Q';

    // Header info
    ws2.mergeCells(`A1:${lastColLetter}1`);
    ws2.getCell('A1').value = `MONTHLY SUMMARY DATA REPORT - WIW ONLINE MONITORING ${ci.reportTitle}`;
    ws2.getCell('A1').font = { bold: true, size: 12 };
    ws2.getCell('A1').alignment = { horizontal: 'center' };

    ws2.mergeCells(`A2:${lastColLetter}2`);
    ws2.getCell('A2').value = `${ci.contractTitle} CONTRACT`;
    ws2.getCell('A2').alignment = { horizontal: 'center', wrapText: true };

    ws2.mergeCells(`A3:${lastColLetter}3`);
    ws2.getCell('A3').value = `Contract No: ${ci.contractNo}`;

    ws2.getCell('A5').value = 'Request Order:'; ws2.getCell('B5').value = parseInt(ci.requestOrder) || ci.requestOrder;
    ws2.getCell('G5').value = 'Start Date:'; ws2.getCell('H5').value = displayStart;
    ws2.getCell('A6').value = 'Periode:'; ws2.getCell('B6').value = ci.periode;
    ws2.getCell('G6').value = 'End Date:'; ws2.getCell('H6').value = displayEnd;

    // Header tabel (sesuai format laporan — 10 kolom)
    const h8 = ws2.getRow(8);
    const h8vals = [
        'WELLNAME', 'RTU_ID', 'DATE', '#DATA', 'AVAILABILITY (%)', '#DATA PAY',
        'AVG FLOW_RATE', 'AVG INTERNAL_TEMP_C', 'AVG SUPPLY_VOLTAGE', 'AVG BATTERY_VOLTAGE'
    ];
    h8vals.forEach((v, i) => {
        const c = h8.getCell(i + 1);
        c.value = v;
        c.font = { bold: true, color: { argb: WHITE } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Data baris (SEMUA data, bukan hanya yang bisa ditagih)
    const allSorted = [...appState.allData].sort((a, b) => a.nodeID.localeCompare(b.nodeID) || a.date.localeCompare(b.date));
    let dr = 9;
    allSorted.forEach(row => {
        const r = ws2.getRow(dr);
        r.values = [
            row.nodeID, row.rtuId || '-', row.date, row.rowCount, row.availability, row.status,
            row.avgFlowrate, row.avgTemp, row.avgSupplyV, row.avgBatteryV
        ];
        r.getCell(5).numFmt = '0.00"%"';
        [7, 8, 9, 10].forEach(c => r.getCell(c).numFmt = '#,##0.0000');
        const fillColor = row.status === 1 ? 'FFC8E6C9' : 'FFFFCDD2';
        r.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            cell.border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
        });
        dr++;
    });

    // Set lebar kolom (10 kolom)
    ws2.columns.forEach((col, i) => {
        const widths = [16, 10, 12, 10, 14, 10, 14, 16, 16, 16];
        col.width = widths[i] || 14;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const periode = ci.periode.replace(/\s/g, '_');
    downloadBlob(buffer, `Billable_of_WIW_Online_Monitoring_Periode_${periode}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function downloadBlob(buffer, filename, mime) {
    const blob = new Blob([buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

// ---------------------- EXPORT PDF ----------------------
document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);

function exportToPDF() {
    if (appState.allData.length === 0) { alert('Tidak ada data untuk di-export.'); return; }
    const ci = getContractInfo();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210;

    // --- LOGIKA START/END DATE (sama dengan Export Excel) ---
    // Prioritas: 1) Input user (format bebas), 2) Auto dari data mentah
    let displayStart = ci.startDate && ci.startDate.trim() ? ci.startDate.trim() : '';
    let displayEnd = ci.endDate && ci.endDate.trim() ? ci.endDate.trim() : '';

    if (!displayStart || !displayEnd) {
        const dates = appState.allData
            .map(r => r.date)
            .filter(d => d && d !== 'Unknown Date')
            .sort();
        if (dates.length > 0) {
            function toDDMMMYY(iso) {
                if (!iso) return '';
                const d = new Date(iso + 'T00:00:00Z');
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return `${String(d.getUTCDate()).padStart(2,'0')}-${months[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(-2)}`;
            }
            if (!displayStart) displayStart = toDDMMMYY(dates[0]);
            if (!displayEnd) displayEnd = toDDMMMYY(dates[dates.length - 1]);
        }
    }

    // ---- HALAMAN 1: BILLABLE SUMMARY ----
    doc.setFillColor(31, 56, 100);
    doc.rect(0, 0, W, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.text('MONTHLY SUMMARY DATA REPORT — WIW ONLINE MONITORING', W / 2, 8, { align: 'center' });

    doc.setTextColor(30, 30, 30); doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    const infoY = 16;
    doc.setFont(undefined, 'bold'); doc.text('Contract:', 10, infoY);
    doc.setFont(undefined, 'normal'); doc.text(ci.contractNo, 40, infoY);
    doc.setFont(undefined, 'bold'); doc.text('Document No.:', 160, infoY);
    doc.setFont(undefined, 'normal'); doc.text(ci.docNo, 195, infoY);

    doc.setFont(undefined, 'bold'); doc.text('Contract Title:', 10, infoY + 5);
    doc.setFont(undefined, 'normal');
    const splitTitle = doc.splitTextToSize(ci.contractTitle, 110);
    doc.text(splitTitle, 40, infoY + 5);
    doc.setFont(undefined, 'bold'); doc.text('Start :', 160, infoY + 5);
    doc.setFont(undefined, 'normal'); doc.text(displayStart, 195, infoY + 5);

    doc.setFont(undefined, 'bold'); doc.text('Request Order:', 10, infoY + 10);
    doc.setFont(undefined, 'normal'); doc.text(String(ci.requestOrder), 40, infoY + 10);
    doc.setFont(undefined, 'bold'); doc.text('End :', 160, infoY + 10);
    doc.setFont(undefined, 'normal'); doc.text(displayEnd, 195, infoY + 10);

    // Tabel billable per sumur
    const totalPerDay = ci.ser02 + ci.ser04 + ci.ser18;
    const wells = [...new Set(appState.allData.map(r => r.nodeID))].sort();
    let totalDataCount = 0;
    const billBody = [];
    wells.forEach((well, i) => {
        const wellRows = appState.allData.filter(r => r.nodeID === well);
        const greenDays = wellRows.filter(r => r.status === 1).length;
        if (greenDays === 0) return;
        totalDataCount += greenDays;
        const grandTotal = greenDays * totalPerDay;
        const rtuId = wellRows[0]?.rtuId || '-';
        billBody.push([
            i + 1, well, 'OPM', rtuId, greenDays,
            `IDR ${ci.ser02.toLocaleString('id-ID', {minimumFractionDigits:2})}`,
            `IDR ${ci.ser04.toLocaleString('id-ID', {minimumFractionDigits:2})}`,
            `IDR ${ci.ser18.toLocaleString('id-ID', {minimumFractionDigits:2})}`,
            `IDR ${totalPerDay.toLocaleString('id-ID', {minimumFractionDigits:2})}`,
            `IDR ${grandTotal.toLocaleString('id-ID', {minimumFractionDigits:2})}`
        ]);
    });
    billBody.push(['', '', '', '', totalDataCount, '', '', '', 'Grand Total',
        `IDR ${(totalDataCount * totalPerDay).toLocaleString('id-ID', {minimumFractionDigits:2})}`
    ]);

    doc.autoTable({
        startY: infoY + 17,
        head: [['No', 'Location Name', 'RTU Tipe', 'RTU ID', '#Data', 'SER-02 (IDR)', 'SER-04 (IDR)', 'SER-18 (IDR)', 'Total (IDR)', 'Grand Total (IDR)']],
        body: billBody,
        headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 28 }, 2: { cellWidth: 14 }, 3: { cellWidth: 12 }, 4: { cellWidth: 12 } },
        didParseCell: h => {
            if (h.section === 'body' && h.row.index === billBody.length - 1) {
                h.cell.styles.fillColor = [255, 241, 118];
                h.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // Breakdown per service code
    const afterTable = doc.lastAutoTable.finalY + 6;
    doc.setFont(undefined, 'bold'); doc.setFontSize(8);
    doc.text('Rincian per Service Code:', 10, afterTable);
    const scBody = [
        ['SER-02', 'On-Off Well/RTU Data Remote', ci.ser02.toLocaleString('id-ID'), totalDataCount, (ci.ser02 * totalDataCount).toLocaleString('id-ID')],
        ['SER-04', 'Optional Remote Power (Solar Panel, dll)', ci.ser04.toLocaleString('id-ID'), totalDataCount, (ci.ser04 * totalDataCount).toLocaleString('id-ID')],
        ['SER-18', 'Optional Data Open Channel Flow Sensor', ci.ser18.toLocaleString('id-ID'), totalDataCount, (ci.ser18 * totalDataCount).toLocaleString('id-ID')],
        ['', 'Grand Total', '', '', ((ci.ser02 + ci.ser04 + ci.ser18) * totalDataCount).toLocaleString('id-ID')]
    ];
    doc.autoTable({
        startY: afterTable + 2,
        head: [['Service Code', 'Description', 'Rate (IDR)', '#Data', 'Grand Total (IDR)']],
        body: scBody,
        headStyles: { fillColor: [31, 56, 100], textColor: 255, fontSize: 7.5 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 1: { cellWidth: 90 } },
        didParseCell: h => {
            if (h.section === 'body' && h.row.index === 3) {
                h.cell.styles.fillColor = [255, 241, 118];
                h.cell.styles.fontStyle = 'bold';
            }
        }
    });

    // ---- HALAMAN 2: DETAIL HARIAN (Landscape A3 untuk 17 kolom) ----
    doc.addPage('a3', 'landscape');
    const W2 = doc.internal.pageSize.getWidth();
    doc.setFillColor(31, 56, 100);
    doc.rect(0, 0, W2, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10); doc.setFont(undefined, 'bold');
    doc.text(`DETAIL HARIAN — ${ci.reportTitle} — ${ci.periode}`, W2 / 2, 7, { align: 'center' });

    const allSorted = [...appState.allData].sort((a, b) => a.nodeID.localeCompare(b.nodeID) || a.date.localeCompare(b.date));
    doc.autoTable({
        startY: 14,
        head: [['Well Name', 'UWI', 'RTU ID', 'Ctrl', 'Date', '#Data', 'Avail (%)', '#Pay',
               'Avg Flow', 'Avg Daily Flow', 'Avg Hourly Flow', 'Grand Total Rate',
               'Hourly RT', 'Avg Temp', 'Avg Sup V', 'Avg Bat V', 'Billing (IDR)']],
        body: allSorted.map(r => [
            r.nodeID, r.uwi || '-', r.rtuId || '-', r.controllerType || '-',
            r.date, r.rowCount,
            r.availability.toFixed(2) + '%',
            r.status === 1 ? '1' : '0',
            (r.avgFlowrate || 0).toFixed(2), (r.avgDailyFlowRate || 0).toFixed(2),
            (r.avgHourlyFlowRate || 0).toFixed(2), (r.avgGrandTotalRate || 0).toFixed(2),
            (r.avgHourlyRuntime || 0).toFixed(2),
            (r.avgTemp || 0).toFixed(2), (r.avgSupplyV || 0).toFixed(2),
            (r.avgBatteryV || 0).toFixed(2),
            getBilling(r).toLocaleString('id-ID')
        ]),
        headStyles: { fillColor: [31, 56, 100], textColor: 255, fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { fontSize: 6.5 },
        didParseCell: h => {
            if (h.section === 'body') {
                const row = allSorted[h.row.index];
                if (row) h.cell.styles.fillColor = row.status === 1 ? [200, 230, 201] : [255, 205, 210];
            }
        }
    });

    const periode = ci.periode.replace(/\s/g, '_');
    doc.save(`Billable_of_WIW_Online_Monitoring_Periode_${periode}.pdf`);
}


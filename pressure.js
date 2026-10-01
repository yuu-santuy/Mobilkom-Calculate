// =====================================================================
// PRESSURE DATA MODULE — v3 (unified table, auto-ignore zero columns,
// sparkline preview, clearer minute ruler, manual calc check, wide export)
// =====================================================================

const PRESS_MINUTES_PER_DAY = 1440;
const PRESS_THRESHOLD = 90;

const pressureState = {
    sources: { Mobilkom: [], Partner: [] },
    diagnostics: { Mobilkom: null, Partner: null },
    uploadMode: { Mobilkom: 'new', Partner: 'new' },
    partnerName: '',
    filters: { search: '', tag: 'ALL', source: 'ALL', status: 'ALL' },
    sort: { key: 'date', dir: 'asc' },
    chart: null,
    selectedFiles: { Mobilkom: null, Partner: null },
    selectedRowKeys: new Set() // set berisi "source__tag__date" baris yang dicentang buat dihapus
};

function pLabel(source) {
    if (source === 'Mobilkom') return 'Mobilkom';
    return pressureState.partnerName.trim() || 'Mitra';
}

// ---------------------- HELPER: DETEKSI KOLOM & WAKTU ----------------------
function pNormalizeCol(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

function pIsPlausibleExcelSerial(v) { return typeof v === 'number' && v > 0 && v < 100000; }
function pLooksLikeDateString(v) { return typeof v === 'string' && /\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(v); }

function detectTimeAndTagCols(headers, sampleRow) {
    const candidates = headers.filter(h => ['timestamp', 'datetime', 'date'].includes(pNormalizeCol(h)));
    let timeCol = null;
    for (const c of candidates) {
        const v = sampleRow ? sampleRow[c] : null;
        if (v instanceof Date || pLooksLikeDateString(v) || pIsPlausibleExcelSerial(v)) { timeCol = c; break; }
    }
    if (!timeCol && candidates.length) timeCol = candidates[0];
    const metaCols = new Set(candidates);
    headers.filter(h => pNormalizeCol(h) === 'frame').forEach(h => metaCols.add(h));
    const tagCols = headers.filter(h => !metaCols.has(h));
    return { timeCol, tagCols };
}

function parseDateTimeFlexible(value) {
    if (value instanceof Date) {
        // Serial tanggal Excel disimpan sebagai pecahan hari (floating point), jadi kadang hasil
        // konversinya meleset beberapa milidetik (mis. niatnya 00:02:00.000 tapi kebaca 00:01:59.997).
        // Dibulatkan ke detik terdekat DULU sebelum ambil jam/menit/detiknya, supaya nggak salah
        // dianggap "detik 59" padahal maksudnya genap ke menit berikutnya.
        const roundedMs = Math.round(value.getTime() / 1000) * 1000;
        const rounded = new Date(roundedMs);
        return new Date(Date.UTC(
            rounded.getUTCFullYear(), rounded.getUTCMonth(), rounded.getUTCDate(),
            rounded.getUTCHours(), rounded.getUTCMinutes(), rounded.getUTCSeconds()
        ));
    }
    if (typeof value === 'number') {
        const epoch = Date.UTC(1899, 11, 30);
        return new Date(epoch + Math.round(value * 86400000));
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        let m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5], m[6] ? +m[6] : 0));
        m = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0));
    }
    return null;
}

function pFormatDateStr(d) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; }
function pFormatMinuteKey(d) { return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; }
function pPad(n) { return String(n).padStart(2, '0'); }

// ---------------------- PARSING 1 FILE ----------------------
async function parsePressureFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let workbook;
    if (ext === 'csv') {
        const text = await file.text();
        workbook = XLSX.read(text, { type: 'string' });
    } else {
        const buffer = await file.arrayBuffer();
        workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    }
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    if (rows.length === 0) return { rows: [], timeCol: null, tagCols: [], totalRawRows: 0, fileName: file.name };

    const headers = Object.keys(rows[0]);
    const { timeCol, tagCols } = detectTimeAndTagCols(headers, rows[0]);
    if (!timeCol) throw new Error(`File "${file.name}" tidak punya kolom tanggal/waktu yang dikenali. Kolom: ${headers.join(', ')}`);

    // Setiap sel titik tekanan diklasifikasikan ke salah satu dari 3 status:
    // - 'connected'    : ada angka yang valid
    // - 'not_connect'  : baris ADA di file, tapi isinya teks non-angka (mis. "Not Connect")
    // - (tidak dicatat sama sekali) : sel kosong / null — dianggap tidak ada percobaan pembacaan
    const parsedRows = [];
    for (const r of rows) {
        const dt = parseDateTimeFlexible(r[timeCol]);
        if (!dt) continue;
        const cells = {};
        tagCols.forEach(t => {
            const raw = r[t];
            if (raw === null || raw === '') return; // benar-benar tidak ada percobaan pembacaan
            const v = parseFloat(raw);
            if (!isNaN(v)) cells[t] = { status: 'connected', value: v };
            else cells[t] = { status: 'not_connect', raw: String(raw) };
        });
        parsedRows.push({ dt, cells });
    }
    return { rows: parsedRows, timeCol, tagCols, totalRawRows: rows.length, fileName: file.name };
}

// ---------------------- DETEKSI GRANULARITAS (1 menit / 30 detik / dst) ----------------------
// Beberapa sumber (mis. Mobilkom) mencatat MAKSIMAL 1x per menit -> basis 1440/hari.
// Sumber lain (mis. PHR) mencatat 2x per menit (~tiap 30 detik) -> basis 2880/hari.
// Dideteksi otomatis dari data itu sendiri (BUKAN hardcode nama sumber), supaya tetap benar
// walau nanti ada sumber ketiga dengan interval yang beda lagi (mis. tiap 20 detik = 3x/menit).
function pDetectSlotsPerMinute(allRows) {
    // Hitung berapa kali ada 2+ baris berbeda yang jatuh di MENIT YANG SAMA untuk tag yang sama.
    // Ini jauh lebih akurat daripada sekadar melihat sebaran detik secara global — karena data
    // yang sebenarnya cuma 1x/menit (seperti Mobilkom) bisa saja punya detik yang bervariasi
    // antar-menit (jitter alat), padahal DALAM 1 menit yang sama tetap cuma ada 1 baris.
    const minuteBuckets = new Map(); // key: tag__tanggal__HH:MM -> jumlah baris berbeda di menit itu
    for (const row of allRows) {
        const dateStr = pFormatDateStr(row.dt);
        const minutePart = `${pPad(row.dt.getUTCHours())}:${pPad(row.dt.getUTCMinutes())}`;
        for (const tag of Object.keys(row.cells)) {
            const k = `${tag}__${dateStr}__${minutePart}`;
            minuteBuckets.set(k, (minuteBuckets.get(k) || 0) + 1);
        }
    }
    let multiCount = 0, total = 0;
    for (const c of minuteBuckets.values()) { total++; if (c >= 2) multiCount++; }
    const ratio = total > 0 ? multiCount / total : 0;
    return ratio > 0.3 ? 2 : 1; // toleran thd sedikit anomali/duplikat, tapi tegas kalau memang pola 2x/menit
}
function pSlotKey(d, slotsPerMinute) {
    const hh = pPad(d.getUTCHours()), mm = pPad(d.getUTCMinutes());
    if (slotsPerMinute <= 1) return `${hh}:${mm}`;
    const bucket = d.getUTCSeconds() < 30 ? '00' : '30';
    return `${hh}:${mm}:${bucket}`;
}

// ---------------------- GROUPING + AUTO-IGNORE KOLOM KOSONG ----------------------
// Kolom yang isinya SELALU 0 (atau tidak pernah punya nilai numerik valid) di SELURUH data otomatis
// dianggap "belum dipakai / placeholder" dan dikeluarkan dari perhitungan availability.
//
// Availability dihitung LANGSUNG dari slot mentah (tanpa dipadatkan/OR-logic per menit lagi):
// setiap slot waktu asli (tiap menit kalau sumbernya 1x/menit, tiap 30 detik kalau 2x/menit, dst)
// dihitung sendiri-sendiri sebagai 'connected' atau tidak. Penyebutnya otomatis ikut menyesuaikan
// (1440 untuk 1x/menit, 2880 untuk 2x/menit) — supaya hasilnya, setelah jadi persentase, tetap
// bisa dibandingkan apple-to-apple antar sumber dengan granularitas berbeda.
function computeGroupsFromRows(allRows) {
    const seenNonZero = new Set();
    const seenAny = new Set();
    for (const row of allRows) {
        for (const [tag, cell] of Object.entries(row.cells)) {
            if (cell.status !== 'connected') continue;
            seenAny.add(tag);
            if (cell.value !== 0) seenNonZero.add(tag);
        }
    }
    const ignoredTags = [...seenAny].filter(t => !seenNonZero.has(t)).sort();
    const usedTags = [...seenNonZero].sort();

    const slotsPerMinute = pDetectSlotsPerMinute(allRows);
    const slotsPerDay = PRESS_MINUTES_PER_DAY * slotsPerMinute;

    const sorted = [...allRows].sort((a, b) => a.dt - b.dt);
    const seenSlot = new Set();
    const groups = {};

    for (const row of sorted) {
        const dateStr = pFormatDateStr(row.dt);
        const slotKey = pSlotKey(row.dt, slotsPerMinute);
        for (const [tag, cell] of Object.entries(row.cells)) {
            if (!usedTags.includes(tag) && !ignoredTags.includes(tag)) continue; // kolom di luar titik yg terdeteksi
            if (ignoredTags.includes(tag)) continue; // lewati kolom yang diabaikan (selalu 0 / placeholder)

            const gKey = `${tag}__${dateStr}`;
            if (!groups[gKey]) groups[gKey] = { tag, date: dateStr, rowCount: 0, notConnectCount: 0, sumValue: 0, minuteMap: new Map(), slotsPerMinute, slotsPerDay };
            const g = groups[gKey];

            // Dedup HANYA untuk slot yang BENAR-BENAR sama persis (mis. file kedobelan upload) —
            // bukan lagi menggabungkan 2 slot berbeda (:00 & :30) jadi 1 keputusan per menit.
            const dedupKey = `${tag}__${dateStr}__${slotKey}`;
            if (seenSlot.has(dedupKey)) continue;
            seenSlot.add(dedupKey);

            if (cell.status === 'connected') {
                g.rowCount++;
                g.sumValue += cell.value;
                g.minuteMap.set(slotKey, { status: 'connected', value: cell.value });
            } else {
                g.notConnectCount++;
                g.minuteMap.set(slotKey, { status: 'not_connect', raw: cell.raw });
            }
        }
    }
    return { groups, ignoredTags, usedTags, slotsPerMinute };
}

function computePressureStats(groups) {
    return Object.values(groups).map(g => {
        const slotsPerDay = g.slotsPerDay || PRESS_MINUTES_PER_DAY;
        const availability = (g.rowCount / slotsPerDay) * 100;
        const trulyMissingCount = slotsPerDay - g.rowCount - g.notConnectCount;
        return {
            tag: g.tag, date: g.date, rowCount: g.rowCount, availability,
            status: availability >= PRESS_THRESHOLD ? 1 : 0,
            avgValue: g.rowCount > 0 ? g.sumValue / g.rowCount : 0,
            sumValue: g.sumValue,
            notConnectCount: g.notConnectCount,
            trulyMissingCount,
            slotsPerMinute: g.slotsPerMinute || 1,
            slotsPerDay,
            minuteMap: g.minuteMap
        };
    }).sort((a, b) => a.tag.localeCompare(b.tag) || a.date.localeCompare(b.date));
}


function isPressGroupIdentical(a, b) { return a.rowCount === b.rowCount && Math.abs(a.sumValue - b.sumValue) < 0.0001; }

function mergePressureData(source, newStats) {
    const existingMap = new Map(pressureState.sources[source].map(g => [`${g.tag}__${g.date}`, g]));
    let added = 0, updated = 0, skipped = 0;
    for (const ng of newStats) {
        const key = `${ng.tag}__${ng.date}`;
        const existing = existingMap.get(key);
        if (!existing) { existingMap.set(key, ng); added++; }
        else if (isPressGroupIdentical(existing, ng)) { skipped++; }
        else { existingMap.set(key, ng); updated++; }
    }
    pressureState.sources[source] = Array.from(existingMap.values()).sort((a, b) => a.tag.localeCompare(b.tag) || a.date.localeCompare(b.date));
    return { added, updated, skipped };
}

// ---------------------- SPARKLINE MINI PREVIEW: 3 warna (Connected / Not Connect / Tidak Tercatat) ----------------------
function buildSparklineHtml(minuteMap, slotsPerMinute) {
    const spm = slotsPerMinute || 1;
    let html = '<div class="press-sparkline" title="Preview per jam: hijau=connected, oranye=not connect, abu=tidak tercatat">';
    for (let h = 0; h < 24; h++) {
        let connected = 0, notConnect = 0;
        const slotsThisHour = 60 * spm;
        for (let m = 0; m < 60; m++) {
            for (let s = 0; s < spm; s++) {
                const key = spm > 1 ? `${pPad(h)}:${pPad(m)}:${pPad(s * 30)}` : `${pPad(h)}:${pPad(m)}`;
                const entry = minuteMap.get(key);
                if (entry && entry.status === 'connected') connected++;
                else if (entry && entry.status === 'not_connect') notConnect++;
            }
        }
        const missing = slotsThisHour - connected - notConnect;
        let bg;
        if (connected === slotsThisHour) bg = '#2e7d32';
        else if (connected === 0 && notConnect === 0) bg = '#e3e7ee';
        else if (notConnect >= connected && notConnect >= missing) bg = '#ef8c1e';
        else bg = `rgba(46,125,50,${(0.2 + (connected / slotsThisHour) * 0.8).toFixed(2)})`;
        html += `<span class="spark-seg" style="background:${bg}" title="Jam ${pPad(h)}:00-${pPad(h)}:59 — ${connected} connected, ${notConnect} not connect, ${missing} tidak tercatat"></span>`;
    }
    html += '</div>';
    return html;
}


// ---------------------- UPLOAD UI ----------------------
['Mobilkom', 'Partner'].forEach(source => {
    const dropzone = document.getElementById(`press-dropzone-${source}`);
    const fileInput = document.getElementById(`press-file-input-${source}`);
    const fileInfo = document.getElementById(`press-file-info-${source}`);
    const fileNameSpan = document.getElementById(`press-file-name-${source}`);
    const processBtn = document.getElementById(`press-process-btn-${source}`);
    const errorEl = document.getElementById(`press-upload-error-${source}`);

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
        e.preventDefault(); dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) selectFiles(Array.from(e.dataTransfer.files));
    });
    fileInput.addEventListener('change', e => { if (e.target.files.length) selectFiles(Array.from(e.target.files)); });

    function selectFiles(files) {
        const invalid = files.find(f => !['xls', 'xlsx', 'csv'].includes(f.name.split('.').pop().toLowerCase()));
        if (invalid) { errorEl.textContent = `⚠ Format file "${invalid.name}" tidak didukung.`; errorEl.classList.remove('hidden'); return; }
        errorEl.classList.add('hidden');
        pressureState.selectedFiles[source] = files;
        fileNameSpan.textContent = files.length === 1 ? `File terpilih: ${files[0].name}` : `${files.length} file terpilih (akan digabung otomatis)`;
        fileInfo.classList.remove('hidden');
        renderExistingDataStatus(source);
    }
    processBtn.addEventListener('click', () => { if (pressureState.selectedFiles[source]) processPressureFiles(source, pressureState.selectedFiles[source]); });
    renderExistingDataStatus(source);
});

// Menampilkan apakah sumber ini SUDAH punya data sebelum upload baru dilakukan (poin 1)
function renderExistingDataStatus(source) {
    const el = document.getElementById(`press-existing-status-${source}`);
    const data = pressureState.sources[source];
    if (data.length === 0) {
        el.classList.add('hidden');
        return;
    }
    const dates = [...new Set(data.map(r => r.date))].sort();
    const tags = new Set(data.map(r => r.tag));
    el.innerHTML = `⚠️ <b>${pLabel(source)} SUDAH punya data</b>: ${tags.size} titik, ${dates.length} tanggal (${dates[0]} – ${dates[dates.length - 1]}). Kalau upload lagi pakai mode <b>Upload Baru</b>, data ini akan DIGANTI. Kalau mau menambah tanpa mengganti, pilih mode <b>Tambahkan</b>. Cek juga tabel "Kelola Data" di bawah kalau mau hapus sebagian saja.`;
    el.classList.remove('hidden');
}

document.querySelectorAll('#press-upload-mode-toggle-Mobilkom .mode-btn, #press-upload-mode-toggle-Partner .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const source = btn.dataset.source;
        const container = btn.closest('.upload-mode-toggle');
        container.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        pressureState.uploadMode[source] = btn.dataset.mode;
    });
});

document.getElementById('press-reset-all-btn').addEventListener('click', () => {
    if (!confirm('Yakin mau reset SEMUA data Pressure (Mobilkom + Mitra)? Ini tidak bisa dibatalkan — kamu harus upload ulang filenya dari awal.')) return;

    pressureState.sources = { Mobilkom: [], Partner: [] };
    pressureState.diagnostics = { Mobilkom: null, Partner: null };
    pressureState.uploadMode = { Mobilkom: 'new', Partner: 'new' };
    pressureState.filters = { search: '', tag: 'ALL', source: 'ALL', status: 'ALL' };
    pressureState.selectedFiles = { Mobilkom: null, Partner: null };

    ['Mobilkom', 'Partner'].forEach(source => {
        document.getElementById(`press-upload-mode-toggle-${source}`).classList.add('hidden');
        document.getElementById(`press-file-info-${source}`).classList.add('hidden');
        document.getElementById(`press-file-input-${source}`).value = '';
        const container = document.getElementById(`press-upload-mode-toggle-${source}`);
        container.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'new'));
    });

    document.getElementById('press-dashboard-section').classList.add('hidden');
    document.getElementById('press-comparison-section').classList.add('hidden');
    document.getElementById('press-search-input').value = '';
    document.getElementById('press-tag-filter-select').innerHTML = '<option value="ALL">Semua Titik</option>';
    document.getElementById('press-source-filter-select').innerHTML = '<option value="ALL">Semua Sumber</option>';

    showToast('🗑 Semua data Pressure sudah direset. Silakan upload dari awal.', 'success');
});

const partnerInput = document.getElementById('press-partner-name-input');
partnerInput.addEventListener('input', () => {
    pressureState.partnerName = partnerInput.value;
    updatePartnerLabelsEverywhere();
    populateSourceDropdown();
});
function updatePartnerLabelsEverywhere() {
    const thA = document.getElementById('press-comp-th-a'); if (thA) thA.textContent = `Availability ${pLabel('Mobilkom')}`;
    const thB = document.getElementById('press-comp-th-b'); if (thB) thB.textContent = `Availability ${pLabel('Partner')}`;
    const thAvgA = document.getElementById('press-comp-th-avga'); if (thAvgA) thAvgA.textContent = `Avg ${pLabel('Mobilkom')}`;
    const thAvgB = document.getElementById('press-comp-th-avgb'); if (thAvgB) thAvgB.textContent = `Avg ${pLabel('Partner')}`;
}

// ---------------------- PROSES FILE ----------------------
async function processPressureFiles(source, files) {
    const fileInfo = document.getElementById(`press-file-info-${source}`);
    const errorEl = document.getElementById(`press-upload-error-${source}`);
    fileInfo.classList.add('hidden');
    document.getElementById('press-loading-overlay').classList.remove('hidden');

    try {
        await pSetLoadingStep(`Membaca ${files.length} file ${pLabel(source)}...`, 15);
        let allRows = [];
        const fileDiagnostics = [];
        for (const file of files) {
            const parsed = await parsePressureFile(file);
            allRows = allRows.concat(parsed.rows);
            fileDiagnostics.push({ fileName: parsed.fileName, totalRawRows: parsed.totalRawRows, timeCol: parsed.timeCol, tagCols: parsed.tagCols });
        }
        if (allRows.length === 0) throw new Error('Tidak ada baris data valid yang terbaca.');

        await pSetLoadingStep('Mendeteksi titik & menggabungkan per menit (dedup)...', 50);
        const { groups, ignoredTags, usedTags } = computeGroupsFromRows(allRows);

        await pSetLoadingStep('Menghitung availability & rata-rata...', 80);
        const stats = computePressureStats(groups);

        await pSetLoadingStep('Menyusun laporan...', 100);

        const isFirstUpload = pressureState.sources[source].length === 0;
        const mode = isFirstUpload ? 'new' : pressureState.uploadMode[source];
        let mergeReport;
        if (mode === 'new') { pressureState.sources[source] = stats; mergeReport = { added: stats.length, updated: 0, skipped: 0 }; }
        else mergeReport = mergePressureData(source, stats);

        pressureState.diagnostics[source] = { files: fileDiagnostics, totalGroups: pressureState.sources[source].length, ignoredTags, usedTags };

        document.getElementById(`press-upload-mode-toggle-${source}`).classList.remove('hidden');
        document.getElementById(`press-file-input-${source}`).value = '';
        pressureState.selectedFiles[source] = null;

        populateSourceDropdown();
        populatePressureTagDropdown();
        renderPressureDiagnosticPanel();
        applyPressureFiltersAndRender();
        renderComparisonSection();
        renderExistingDataStatus(source);

        document.getElementById('press-loading-overlay').classList.add('hidden');
        document.getElementById('press-dashboard-section').classList.remove('hidden');

        showToast(`✅ Data ${pLabel(source)}: +${mergeReport.added} ditambah, ${mergeReport.updated} diperbarui, ${mergeReport.skipped} dilewati.`, 'success');
    } catch (err) {
        document.getElementById('press-loading-overlay').classList.add('hidden');
        fileInfo.classList.remove('hidden');
        errorEl.textContent = `⚠ ${err.message}`;
        errorEl.classList.remove('hidden');
    }
}

function pSetLoadingStep(message, percent) {
    document.getElementById('press-loading-message').textContent = message;
    document.getElementById('press-progress-bar').style.width = percent + '%';
    return new Promise(resolve => setTimeout(resolve, 200));
}

// ---------------------- DIAGNOSTIK ----------------------
function renderPressureDiagnosticPanel() {
    const body = document.getElementById('press-diagnostic-body');
    let html = '';
    ['Mobilkom', 'Partner'].forEach(source => {
        const diag = pressureState.diagnostics[source];
        if (!diag) { html += `<p>Sumber <b>${pLabel(source)}</b>: belum ada data.</p>`; return; }
        html += `<h4>📁 ${pLabel(source)} (${diag.totalGroups} grup titik×tanggal)</h4>`;
        html += `<table><thead><tr><th>Nama File</th><th>Baris Mentah</th><th>Kolom Waktu</th></tr></thead><tbody>`;
        diag.files.forEach(f => html += `<tr><td>${f.fileName}</td><td>${f.totalRawRows}</td><td><code>${f.timeCol}</code></td></tr>`);
        html += `</tbody></table>`;
        html += `<p><span class="tag-ok">✅ Titik yang DIHITUNG:</span> ${diag.usedTags.join(', ') || '-'}</p>`;
        if (diag.ignoredTags.length) html += `<p><span class="tag-miss">⛔ Titik yang DIABAIKAN (selalu bernilai 0 / belum dipakai):</span> ${diag.ignoredTags.join(', ')}</p>`;
    });
    body.innerHTML = html;
}
document.getElementById('press-diagnostic-toggle').addEventListener('click', () => {
    const body = document.getElementById('press-diagnostic-body');
    const arrow = document.getElementById('press-diagnostic-arrow');
    body.classList.toggle('hidden'); arrow.textContent = body.classList.contains('hidden') ? '▼' : '▲';
});

// ---------------------- DROPDOWN & FILTER ----------------------
function populateSourceDropdown() {
    const select = document.getElementById('press-source-filter-select');
    const current = select.value;
    select.innerHTML = '<option value="ALL">Semua Sumber</option>' +
        ['Mobilkom', 'Partner'].filter(s => pressureState.sources[s].length > 0).map(s => `<option value="${s}">${pLabel(s)}</option>`).join('');
    select.value = current || 'ALL';
}
function populatePressureTagDropdown() {
    const allTags = new Set();
    Object.values(pressureState.sources).forEach(arr => arr.forEach(r => allTags.add(r.tag)));
    const select = document.getElementById('press-tag-filter-select');
    select.innerHTML = '<option value="ALL">Semua Titik</option>' + [...allTags].sort().map(t => `<option value="${t}">${t}</option>`).join('');
}

document.getElementById('press-search-input').addEventListener('input', e => { pressureState.filters.search = e.target.value.trim().toLowerCase(); applyPressureFiltersAndRender(); });
document.getElementById('press-tag-filter-select').addEventListener('change', e => { pressureState.filters.tag = e.target.value; applyPressureFiltersAndRender(); });
document.getElementById('press-source-filter-select').addEventListener('change', e => { pressureState.filters.source = e.target.value; applyPressureFiltersAndRender(); });
document.querySelectorAll('#page-pressure .status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#page-pressure .status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        pressureState.filters.status = btn.dataset.pstatus;
        applyPressureFiltersAndRender();
    });
});
document.getElementById('press-reset-filter-btn').addEventListener('click', () => {
    pressureState.filters = { search: '', tag: 'ALL', source: 'ALL', status: 'ALL' };
    document.getElementById('press-search-input').value = '';
    document.getElementById('press-tag-filter-select').value = 'ALL';
    document.getElementById('press-source-filter-select').value = 'ALL';
    document.querySelectorAll('#page-pressure .status-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#page-pressure .status-btn[data-pstatus="ALL"]').classList.add('active');
    applyPressureFiltersAndRender();
});

function getAllPressureRows() {
    const combined = [];
    Object.entries(pressureState.sources).forEach(([source, arr]) => arr.forEach(r => combined.push({ ...r, source })));
    return combined;
}
function getFilteredPressureData() {
    const { search, tag, source, status } = pressureState.filters;
    return getAllPressureRows().filter(row => {
        if (tag !== 'ALL' && row.tag !== tag) return false;
        if (source !== 'ALL' && row.source !== source) return false;
        if (status !== 'ALL' && String(row.status) !== status) return false;
        if (search && !(row.tag + ' ' + row.date).toLowerCase().includes(search)) return false;
        return true;
    });
}
function applyPressureFiltersAndRender() {
    const filtered = getFilteredPressureData();
    renderPressureSummary(filtered);
    renderPressureTable(sortPressureData(filtered));
    renderPressureChart(filtered);
}

document.querySelectorAll('#press-main-table thead th[data-psort]').forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.psort;
        if (pressureState.sort.key === key) pressureState.sort.dir = pressureState.sort.dir === 'asc' ? 'desc' : 'asc';
        else { pressureState.sort.key = key; pressureState.sort.dir = 'asc'; }
        applyPressureFiltersAndRender();
    });
});
function sortPressureData(data) {
    const { key, dir } = pressureState.sort;
    const factor = dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
        const av = key === 'source' ? pLabel(a.source) : a[key];
        const bv = key === 'source' ? pLabel(b.source) : b[key];
        if (typeof av === 'string') return av.localeCompare(bv) * factor;
        return (av - bv) * factor;
    });
}

// ---------------------- SUMMARY ----------------------
function renderPressureSummary(data) {
    const tags = new Set(data.map(r => r.tag));
    const avgAvail = data.length ? data.reduce((s, r) => s + r.availability, 0) / data.length : 0;
    document.getElementById('press-sum-total').textContent = tags.size;
    document.getElementById('press-sum-avg').textContent = avgAvail.toFixed(2) + '%';
    document.getElementById('press-sum-green').textContent = data.filter(r => r.status === 1).length;
    document.getElementById('press-sum-red').textContent = data.filter(r => r.status === 0).length;
}

// ---------------------- TABEL DETAIL ----------------------
function rowKeyOf(row) { return `${row.source}__${row.tag}__${row.date}`; }

function renderPressureTable(data) {
    const tbody = document.getElementById('press-table-body');
    const emptyMsg = document.getElementById('press-table-empty-msg');
    tbody.innerHTML = '';
    if (data.length === 0) { emptyMsg.classList.remove('hidden'); updateDeleteSelectedButton(); return; }
    emptyMsg.classList.add('hidden');

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = row.status === 1 ? 'status-green' : 'status-red';
        const badge = row.status === 1 ? '<span class="status-badge status-badge-green">🟢 HIJAU</span>' : '<span class="status-badge status-badge-red">🔴 MERAH</span>';
        const key = rowKeyOf(row);
        const checked = pressureState.selectedRowKeys.has(key) ? 'checked' : '';
        tr.innerHTML = `
            <td><input type="checkbox" class="press-row-checkbox" data-key="${key}" ${checked}></td>
            <td>${pLabel(row.source)}</td>
            <td>${row.tag}</td>
            <td>${row.date}</td>
            <td>${row.rowCount} / ${row.slotsPerDay}</td>
            <td class="press-breakdown-cell"><span class="tag-ok">C:${row.rowCount}</span> / <span class="breakdown-notconnect">NC:${row.notConnectCount}</span> / <span class="breakdown-missing">TT:${row.trulyMissingCount}</span></td>
            <td>${row.availability.toFixed(2)}%</td>
            <td>${badge}</td>
            <td>${row.avgValue.toFixed(3)}</td>
            <td>${buildSparklineHtml(row.minuteMap, row.slotsPerMinute)}</td>
            <td class="press-action-cell">
                <button class="btn-verify btn-detail-time" data-source="${row.source}" data-tag="${row.tag}" data-date="${row.date}">Lihat Detail</button>
                <button class="btn-verify btn-detail-calc" data-source="${row.source}" data-tag="${row.tag}" data-date="${row.date}">Cek Perhitungan</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-detail-time').forEach(btn => btn.addEventListener('click', () => {
        const row = pressureState.sources[btn.dataset.source].find(r => r.tag === btn.dataset.tag && r.date === btn.dataset.date);
        openPressureDetailModal(row, btn.dataset.source);
    }));
    tbody.querySelectorAll('.btn-detail-calc').forEach(btn => btn.addEventListener('click', () => {
        const row = pressureState.sources[btn.dataset.source].find(r => r.tag === btn.dataset.tag && r.date === btn.dataset.date);
        openPressureCalcModal(row, btn.dataset.source);
    }));
    tbody.querySelectorAll('.press-row-checkbox').forEach(cb => cb.addEventListener('change', () => {
        if (cb.checked) pressureState.selectedRowKeys.add(cb.dataset.key);
        else pressureState.selectedRowKeys.delete(cb.dataset.key);
        updateDeleteSelectedButton();
        syncSelectAllCheckbox();
    }));
    updateDeleteSelectedButton();
    syncSelectAllCheckbox();
}

function updateDeleteSelectedButton() {
    const btn = document.getElementById('press-delete-selected-btn');
    btn.textContent = `🗑 Hapus yang Dipilih (${pressureState.selectedRowKeys.size})`;
    btn.disabled = pressureState.selectedRowKeys.size === 0;
}
function syncSelectAllCheckbox() {
    const all = document.getElementById('press-select-all-checkbox');
    const boxes = [...document.querySelectorAll('.press-row-checkbox')];
    all.checked = boxes.length > 0 && boxes.every(b => b.checked);
    all.indeterminate = boxes.some(b => b.checked) && !all.checked;
}

document.getElementById('press-select-all-checkbox').addEventListener('change', e => {
    const boxes = document.querySelectorAll('.press-row-checkbox');
    boxes.forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) pressureState.selectedRowKeys.add(cb.dataset.key);
        else pressureState.selectedRowKeys.delete(cb.dataset.key);
    });
    updateDeleteSelectedButton();
});

document.getElementById('press-delete-selected-btn').addEventListener('click', () => {
    const n = pressureState.selectedRowKeys.size;
    if (n === 0) return;
    if (!confirm(`Yakin mau hapus ${n} baris data yang dicentang? Ini tidak bisa dibatalkan.`)) return;

    ['Mobilkom', 'Partner'].forEach(source => {
        pressureState.sources[source] = pressureState.sources[source].filter(r => !pressureState.selectedRowKeys.has(rowKeyOf({ ...r, source })));
    });
    pressureState.selectedRowKeys.clear();

    populateSourceDropdown();
    populatePressureTagDropdown();
    renderPressureDiagnosticPanel();
    applyPressureFiltersAndRender();
    renderComparisonSection();
    renderExistingDataStatus('Mobilkom');
    renderExistingDataStatus('Partner');
    showToast(`🗑 ${n} baris data dihapus.`, 'success');
});


// ---------------------- MODAL DETAIL WAKTU: RULER + INFO BAR + TIMELINE (3 status) ----------------------
function openPressureDetailModal(row, source) {
    document.getElementById('press-grid-title').textContent = `${pLabel(source)} — ${row.tag} — ${row.date} (${row.rowCount}/${row.slotsPerDay} ${row.slotsPerMinute > 1 ? 'slot (tiap 30 detik)' : 'menit'} connected, ${row.availability.toFixed(2)}%)`;

    let html = `<div id="press-hover-readout" class="press-hover-readout">Arahkan mouse ke kotak untuk lihat detail jamnya.</div>`;

    html += `<div class="timeline-ruler"><span class="timeline-hour"></span><div class="timeline-track">`;
    for (let t = 0; t < 60; t += 10) html += `<span class="ruler-tick">${pPad(t)}</span>`;
    html += `</div></div>`;

    html += `<div class="press-timeline">`;
    for (let h = 0; h < 24; h++) {
        html += `<div class="timeline-row"><span class="timeline-hour">${pPad(h)}</span><div class="timeline-track">`;
        for (let m = 0; m < 60; m++) {
            const tickClass = (m % 10 === 0) ? ' tick-start' : '';
            for (let s = 0; s < row.slotsPerMinute; s++) {
                const key = row.slotsPerMinute > 1 ? `${pPad(h)}:${pPad(m)}:${pPad(s * 30)}` : `${pPad(h)}:${pPad(m)}`;
                const entry = row.minuteMap.get(key);
                const subClass = row.slotsPerMinute > 1 ? ' timeline-subslot' : '';
                if (!entry) {
                    html += `<span class="timeline-block missing${tickClass}${subClass}" onmouseenter="updatePressReadout('${key}', 'missing')"></span>`;
                } else if (entry.status === 'connected') {
                    html += `<span class="timeline-block present${tickClass}${subClass}" onmouseenter="updatePressReadout('${key}', 'connected', ${entry.value})"></span>`;
                } else {
                    html += `<span class="timeline-block notconnect${tickClass}${subClass}" onmouseenter="updatePressReadout('${key}', 'not_connect')"></span>`;
                }
            }
        }
        html += `</div></div>`;
    }
    html += `</div>`;
    html += `<div class="timeline-legend">
        <span><i class="legend-dot legend-present"></i> Connected</span>
        <span><i class="legend-dot legend-notconnect"></i> Not Connect</span>
        <span><i class="legend-dot legend-missing"></i> Tidak Tercatat</span>
    </div>`;

    document.getElementById('press-grid-body').innerHTML = html;
    document.getElementById('press-grid-modal').classList.remove('hidden');
}
function updatePressReadout(key, status, val) {
    const el = document.getElementById('press-hover-readout');
    if (!el) return;
    if (status === 'connected') { el.textContent = `⏱ Jam ${key} — CONNECTED, nilai = ${val}`; el.className = 'press-hover-readout readout-present'; }
    else if (status === 'not_connect') { el.textContent = `⏱ Jam ${key} — NOT CONNECT (baris ada di file, tapi statusnya terputus)`; el.className = 'press-hover-readout readout-notconnect'; }
    else { el.textContent = `⏱ Jam ${key} — TIDAK TERCATAT sama sekali (tidak ada baris di file untuk menit ini)`; el.className = 'press-hover-readout readout-missing'; }
}
document.getElementById('press-grid-close').addEventListener('click', () => document.getElementById('press-grid-modal').classList.add('hidden'));
document.getElementById('press-grid-modal').addEventListener('click', e => { if (e.target.id === 'press-grid-modal') e.target.classList.add('hidden'); });

// ---------------------- MODAL CEK PERHITUNGAN (detail, 3-status) ----------------------
function openPressureCalcModal(row, source) {
    document.getElementById('press-calc-title').textContent = `Cek Perhitungan — ${pLabel(source)} — ${row.tag} — ${row.date}`;

    const allEntries = [...row.minuteMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const connectedAll = allEntries.filter(([, e]) => e.status === 'connected');
    const notConnectAll = allEntries.filter(([, e]) => e.status === 'not_connect');
    const granularityLabel = row.slotsPerMinute > 1 ? `setiap 30 detik (${row.slotsPerMinute}x per menit)` : 'setiap 1 menit';

    const connectedRowsHtml = connectedAll.map(([jam, e], i) => `<tr><td>${i + 1}</td><td>${jam}</td><td class="tag-ok">Connected</td><td>${e.value}</td></tr>`).join('');
    const notConnectRowsHtml = notConnectAll.map(([jam, e], i) => `<tr><td>${i + 1}</td><td>${jam}</td><td class="tag-miss">Not Connect</td><td>"${e.raw}"</td></tr>`).join('');

    document.getElementById('press-calc-body').innerHTML = `
        <div class="verify-formula verify-formula-highlight"><b>Granularitas Terdeteksi</b>
            <code>Data ini tercatat ${granularityLabel} -> basis harian = ${row.slotsPerDay} slot/hari
(1440 slot kalau 1x/menit, 2880 slot kalau 2x/menit, dst — dideteksi otomatis dari file)</code>
        </div>
        <div class="verify-formula"><b>Status per Slot (total = ${row.slotsPerDay})</b>
            <code>Connected      = ${row.rowCount}
Not Connect    = ${row.notConnectCount}
Tidak Tercatat = ${row.trulyMissingCount}
Total          = ${row.rowCount + row.notConnectCount + row.trulyMissingCount}</code>
        </div>
        <div class="verify-formula"><b>Availability</b>
            <code>(${row.rowCount} / ${row.slotsPerDay}) × 100 = ${row.availability.toFixed(4)}%</code>
        </div>
        <div class="verify-formula"><b>Status Billing</b>
            <code>${row.availability.toFixed(2)}% ${row.status === 1 ? '≥' : '<'} 90% → Status ${row.status} (${row.status === 1 ? 'Bisa Ditagih' : 'Belum Bisa Ditagih'})</code>
        </div>
        <div class="verify-formula"><b>Avg Pressure</b>
            <code>${row.sumValue.toFixed(4)} / ${row.rowCount} = ${row.avgValue.toFixed(6)}</code>
        </div>
        <p><b>Seluruh ${connectedAll.length} slot Connected:</b></p>
        <div class="verify-table-wrap">
            <table><thead><tr><th>#</th><th>Jam</th><th>Status</th><th>Nilai</th></tr></thead><tbody>${connectedRowsHtml || '<tr><td colspan="4">Tidak ada.</td></tr>'}</tbody></table>
        </div>
        ${notConnectAll.length > 0 ? `
        <p><b>Seluruh ${notConnectAll.length} slot Not Connect:</b></p>
        <div class="verify-table-wrap">
            <table><thead><tr><th>#</th><th>Jam</th><th>Status</th><th>Isi Asli</th></tr></thead><tbody>${notConnectRowsHtml}</tbody></table>
        </div>` : ''}
    `;
    document.getElementById('press-calc-modal').classList.remove('hidden');
}
document.getElementById('press-calc-close').addEventListener('click', () => document.getElementById('press-calc-modal').classList.add('hidden'));
document.getElementById('press-calc-modal').addEventListener('click', e => { if (e.target.id === 'press-calc-modal') e.target.classList.add('hidden'); });

// ---------------------- CHART ----------------------
function renderPressureChart(data) {
    const ctx = document.getElementById('press-chart').getContext('2d');
    const title = document.getElementById('press-chart-title');
    if (pressureState.chart) pressureState.chart.destroy();
    const tagFilter = pressureState.filters.tag;

    if (tagFilter !== 'ALL') {
        title.textContent = `📈 Trend Availability — ${tagFilter}`;
        const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
        const gradient = ctx.createLinearGradient(0, 0, 0, 320);
        gradient.addColorStop(0, 'rgba(10,44,92,0.35)'); gradient.addColorStop(1, 'rgba(10,44,92,0.02)');

        const bySource = { Mobilkom: sorted.filter(r => r.source === 'Mobilkom'), Partner: sorted.filter(r => r.source === 'Partner') };
        const datasets = [];
        if (bySource.Mobilkom.length) datasets.push({ label: pLabel('Mobilkom'), data: bySource.Mobilkom.map(r => ({ x: r.date, y: r.availability })), borderColor: '#0a2c5c', backgroundColor: gradient, fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: bySource.Mobilkom.map(r => r.status === 1 ? '#2e7d32' : '#c62828') });
        if (bySource.Partner.length) datasets.push({ label: pLabel('Partner'), data: bySource.Partner.map(r => ({ x: r.date, y: r.availability })), borderColor: '#d32f2f', backgroundColor: 'rgba(211,47,47,0.08)', fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: bySource.Partner.map(r => r.status === 1 ? '#2e7d32' : '#c62828') });
        datasets.push({ label: 'Batas Minimum (90%)', data: sorted.map(r => ({ x: r.date, y: 90 })), borderColor: '#d4a017', borderDash: [8, 4], borderWidth: 2, pointRadius: 0, fill: false });

        pressureState.chart = new Chart(ctx, { type: 'line', data: { datasets }, options: { responsive: true, maintainAspectRatio: false, parsing: false, scales: { x: { type: 'category' }, y: { min: 0, max: 105, ticks: { callback: v => v + '%' } } }, plugins: { legend: { position: 'bottom' } } } });
    } else {
        title.textContent = '📊 Rata-rata Availability antar Titik';
        const tagMap = {};
        data.forEach(r => { if (!tagMap[r.tag]) tagMap[r.tag] = []; tagMap[r.tag].push(r.availability); });
        const tags = Object.keys(tagMap).sort();
        const avgs = tags.map(t => tagMap[t].reduce((a, b) => a + b, 0) / tagMap[t].length);
        pressureState.chart = new Chart(ctx, { type: 'bar', data: { labels: tags, datasets: [{ label: 'Rata-rata Availability (%)', data: avgs, backgroundColor: avgs.map(v => v >= 90 ? 'rgba(46,125,50,0.75)' : 'rgba(198,40,40,0.75)'), borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 105, ticks: { callback: v => v + '%' } } } } });
    }
}

// ---------------------- PERBANDINGAN OTOMATIS ----------------------
function getComparisonRows() {
    const mapA = new Map(pressureState.sources.Mobilkom.map(r => [`${r.tag}__${r.date}`, r]));
    const mapB = new Map(pressureState.sources.Partner.map(r => [`${r.tag}__${r.date}`, r]));
    const rows = [];
    for (const key of mapA.keys()) {
        if (!mapB.has(key)) continue;
        const a = mapA.get(key), b = mapB.get(key);
        rows.push({ tag: a.tag, date: a.date, availA: a.availability, availB: b.availability, statusA: a.status, statusB: b.status, avgA: a.avgValue, avgB: b.avgValue });
    }
    return rows.sort((x, y) => x.tag.localeCompare(y.tag) || x.date.localeCompare(y.date));
}

function renderComparisonSection() {
    const section = document.getElementById('press-comparison-section');
    const bothHaveData = pressureState.sources.Mobilkom.length > 0 && pressureState.sources.Partner.length > 0;
    section.classList.toggle('hidden', !bothHaveData);
    if (!bothHaveData) return;

    updatePartnerLabelsEverywhere();
    const rows = getComparisonRows();
    const tbody = document.getElementById('press-comparison-body');
    const emptyMsg = document.getElementById('press-comparison-empty');

    const totalMatch = rows.length;
    const avgDiff = totalMatch ? rows.reduce((s, r) => s + Math.abs(r.availA - r.availB), 0) / totalMatch : 0;
    const okCount = rows.filter(r => r.statusA === r.statusB).length;

    document.getElementById('press-comp-total').textContent = totalMatch;
    document.getElementById('press-comp-avgdiff').textContent = avgDiff.toFixed(2) + '%';
    document.getElementById('press-comp-ok').textContent = okCount;
    document.getElementById('press-comp-review').textContent = totalMatch - okCount;

    renderComparisonExplanation(rows, totalMatch, okCount, avgDiff);
    renderComparisonDonut(totalMatch, okCount);
    populateComparisonTitikSelect(rows);
    renderComparisonTrendChart(rows);

    if (rows.length === 0) { emptyMsg.classList.remove('hidden'); tbody.innerHTML = ''; return; }
    emptyMsg.classList.add('hidden');

    tbody.innerHTML = rows.map(r => {
        const diffAvail = r.availA - r.availB, diffAvg = r.avgA - r.avgB;
        const cocok = r.statusA === r.statusB;
        const verifBadge = cocok ? '<span class="status-badge status-badge-green">✅ Cocok</span>' : '<span class="status-badge status-badge-red">⚠️ Perlu Ditinjau</span>';
        return `<tr class="${cocok ? '' : 'row-flagged'}">
            <td>${r.tag}</td><td>${r.date}</td>
            <td>${r.availA.toFixed(2)}%</td><td>${r.availB.toFixed(2)}%</td>
            <td>${diffAvail >= 0 ? '+' : ''}${diffAvail.toFixed(2)}%</td>
            <td>${r.avgA.toFixed(3)}</td><td>${r.avgB.toFixed(3)}</td>
            <td>${diffAvg >= 0 ? '+' : ''}${diffAvg.toFixed(3)}</td>
            <td>${verifBadge}</td>
        </tr>`;
    }).join('');
}

// Penjelasan otomatis berbentuk teks berdasarkan hasil perbandingan aktual
function renderComparisonExplanation(rows, totalMatch, okCount, avgDiff) {
    const el = document.getElementById('press-comp-explanation');
    if (totalMatch === 0) { el.innerHTML = '<p>Belum ada titik/tanggal yang bisa dibandingkan.</p>'; return; }
    const reviewCount = totalMatch - okCount;
    const pctOk = ((okCount / totalMatch) * 100).toFixed(1);
    const worst = [...rows].sort((a, b) => Math.abs(b.availA - b.availB) - Math.abs(a.availA - a.availB))[0];

    let html = `<p>Dari <b>${totalMatch}</b> titik+tanggal yang tercatat di kedua sumber, <b>${okCount} (${pctOk}%)</b> status billing-nya SAMA antara ${pLabel('Mobilkom')} dan ${pLabel('Partner')}, sedangkan <b>${reviewCount}</b> berbeda dan perlu ditinjau. Rata-rata selisih availability keseluruhan adalah <b>${avgDiff.toFixed(2)}%</b>.</p>`;
    if (worst && Math.abs(worst.availA - worst.availB) > 0.01) {
        html += `<p>Selisih terbesar ditemukan pada titik <b>${worst.tag}</b> tanggal <b>${worst.date}</b> (${pLabel('Mobilkom')}: ${worst.availA.toFixed(2)}% vs ${pLabel('Partner')}: ${worst.availB.toFixed(2)}%, selisih ${Math.abs(worst.availA - worst.availB).toFixed(2)}%).</p>`;
    }
    el.innerHTML = html;
}

let pressCompDonutChart = null;
function renderComparisonDonut(totalMatch, okCount) {
    const ctx = document.getElementById('press-comp-donut').getContext('2d');
    if (pressCompDonutChart) pressCompDonutChart.destroy();
    const reviewCount = totalMatch - okCount;
    pressCompDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['✅ Cocok', '⚠️ Perlu Ditinjau'],
            datasets: [{ data: [okCount, reviewCount], backgroundColor: ['#2e7d32', '#c62828'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

// Dropdown pilih titik utk chart trend (interaktif — biar bisa dieksplor per titik)
let pressCompRowsCache = [];
function populateComparisonTitikSelect(rows) {
    pressCompRowsCache = rows;
    const select = document.getElementById('press-comp-titik-select');
    const tags = [...new Set(rows.map(r => r.tag))].sort();
    const current = select.value;
    select.innerHTML = tags.map(t => `<option value="${t}">${t}</option>`).join('');
    if (tags.includes(current)) select.value = current;
}
document.getElementById('press-comp-titik-select').addEventListener('change', () => renderComparisonTrendChart(pressCompRowsCache));

let pressCompTrendChart = null;
function renderComparisonTrendChart(rows) {
    const select = document.getElementById('press-comp-titik-select');
    const selectedTag = select.value;
    const filtered = rows.filter(r => r.tag === selectedTag).sort((a, b) => a.date.localeCompare(b.date));

    const ctx = document.getElementById('press-comp-bar').getContext('2d');
    if (pressCompTrendChart) pressCompTrendChart.destroy();
    pressCompTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: filtered.map(r => r.date),
            datasets: [
                { label: pLabel('Mobilkom'), data: filtered.map(r => r.availA), borderColor: '#0a2c5c', backgroundColor: 'rgba(10,44,92,0.1)', fill: true, tension: 0.3, pointRadius: 4 },
                { label: pLabel('Partner'), data: filtered.map(r => r.availB), borderColor: '#d32f2f', backgroundColor: 'rgba(211,47,47,0.08)', fill: true, tension: 0.3, pointRadius: 4 },
                { label: 'Batas Minimum (90%)', data: filtered.map(() => 90), borderColor: '#d4a017', borderDash: [8, 4], borderWidth: 2, pointRadius: 0, fill: false }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%` } }
            },
            scales: { y: { min: 0, max: 105, ticks: { callback: v => v + '%' } } }
        }
    });
}

// ---------------------- EXPORT: PIVOT KESAMPING PER SUMBER (dengan RTU) ----------------------
// RTU = nilai availability TERTINGGI di antara semua titik (PT1..PTn) pada tanggal itu.
// Ini terverifikasi cocok 100% dengan pola data referensi "Petani GS" yang diberikan kakak senior:
// RTU merepresentasikan alat komunikasi/RTU induk, dianggap "hidup" kalau minimal 1 titik yang
// tersambung ke dia berhasil lapor pada menit itu, jadi diambil nilai TERBAIK dari titik-titiknya.
function buildWidePivotRows(sourceData) {
    const tagsOrder = [...new Set(sourceData.map(r => r.tag))].sort();
    const dates = [...new Set(sourceData.map(r => r.date))].sort();
    const byKey = new Map(sourceData.map(r => [`${r.tag}__${r.date}`, r]));

    const rows = dates.map(date => {
        const entry = { date };
        let maxAvail = null;
        tagsOrder.forEach((tag, i) => {
            const rec = byKey.get(`${tag}__${date}`);
            const avail = rec ? rec.availability : null;
            entry[`col${i}_avail`] = avail;
            entry[`col${i}_pay`] = rec ? rec.status : null;
            if (avail !== null && (maxAvail === null || avail > maxAvail)) maxAvail = avail;
        });
        entry.rtu_avail = maxAvail;
        entry.rtu_pay = maxAvail === null ? null : (maxAvail >= PRESS_THRESHOLD ? 1 : 0);
        return entry;
    });

    const summary = tagsOrder.map((tag, i) => rows.reduce((s, r) => s + (r[`col${i}_pay`] === 1 ? 1 : 0), 0));
    const rtuSummary = rows.reduce((s, r) => s + (r.rtu_pay === 1 ? 1 : 0), 0);
    return { tagsOrder, dates, rows, summary, rtuSummary };
}

async function runPressureExcelExport(sourcesWithData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PT Mobilkom Telekomindo';

    for (const source of sourcesWithData) {
        const { tagsOrder, dates, rows, summary, rtuSummary } = buildWidePivotRows(pressureState.sources[source]);
        const ws = workbook.addWorksheet(pLabel(source).substring(0, 28) || source);

        const nCols = 3 + tagsOrder.length * 2;
        ws.mergeCells(1, 1, 1, nCols);
        ws.getCell(1, 1).value = `LAPORAN AVAILABILITY PRESSURE — ${pLabel(source).toUpperCase()}`;
        ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: 'FF0A2C5C' } };
        ws.getCell(1, 1).alignment = { horizontal: 'center' };

        ws.getCell(3, 1).value = 'Start Date:'; ws.getCell(3, 2).value = dates[0] || '-';
        ws.getCell(4, 1).value = 'End Date:'; ws.getCell(4, 2).value = dates[dates.length - 1] || '-';

        // Urutan header PERSIS seperti contoh: Name | DateStamp | RTU | PT1..PTn | RTU_Pay | PT1_Pay..PTn_Pay
        const headerRowIdx = 6;
        const headerRow1 = ws.getRow(headerRowIdx);
        headerRow1.getCell(1).value = 'Name';
        headerRow1.getCell(2).value = 'DateStamp';
        headerRow1.getCell(3).value = 'RTU';
        tagsOrder.forEach((tag, i) => { headerRow1.getCell(4 + i).value = `PT${i + 1}`; });
        headerRow1.getCell(4 + tagsOrder.length).value = 'RTU_Pay';
        tagsOrder.forEach((tag, i) => { headerRow1.getCell(5 + tagsOrder.length + i).value = `PT${i + 1}_Pay`; });
        headerRow1.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2C5C' } };
            cell.alignment = { horizontal: 'center' };
        });

        const firstDataRow = headerRowIdx + 1;
        rows.forEach((r, i) => {
            const row = ws.getRow(firstDataRow + i);
            row.getCell(1).value = pLabel(source);
            row.getCell(2).value = r.date;

            const rtuCell = row.getCell(3);
            rtuCell.value = r.rtu_avail === null ? null : r.rtu_avail;
            rtuCell.numFmt = '0.00"%"';
            rtuCell.font = { bold: true };

            tagsOrder.forEach((tag, ti) => {
                const c = row.getCell(4 + ti);
                c.value = r[`col${ti}_avail`] === null ? null : r[`col${ti}_avail`];
                c.numFmt = '0.00"%"';
            });

            const rtuPayCell = row.getCell(4 + tagsOrder.length);
            rtuPayCell.value = r.rtu_pay === null ? null : r.rtu_pay;
            rtuPayCell.font = { bold: true };
            rtuPayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.rtu_pay === 1 ? 'FFC8E6C9' : (r.rtu_pay === 0 ? 'FFFFCDD2' : 'FFFFFFFF') } };

            tagsOrder.forEach((tag, ti) => {
                const pay = r[`col${ti}_pay`];
                const c = row.getCell(5 + tagsOrder.length + ti);
                c.value = pay === null ? null : pay;
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pay === 1 ? 'FFC8E6C9' : (pay === 0 ? 'FFFFCDD2' : 'FFFFFFFF') } };
            });
        });

        const summaryRowIdx = firstDataRow + rows.length + 1;
        ws.getCell(summaryRowIdx, 1).value = 'Name';
        ws.getCell(summaryRowIdx, 3).value = 'RTU#';
        tagsOrder.forEach((tag, i) => { ws.getCell(summaryRowIdx, 4 + i).value = `PT${i + 1}#`; });
        ws.getRow(summaryRowIdx).font = { bold: true };

        ws.getCell(summaryRowIdx + 1, 1).value = pLabel(source);
        ws.getCell(summaryRowIdx + 1, 3).value = rtuSummary;
        tagsOrder.forEach((tag, i) => { ws.getCell(summaryRowIdx + 1, 4 + i).value = summary[i]; });
        ws.getRow(summaryRowIdx + 1).font = { bold: true };

        // Legend nama titik asli (PT1 = nama kolom aslinya)
        const legendRowIdx = summaryRowIdx + 3;
        ws.getCell(legendRowIdx, 1).value = 'Keterangan:';
        ws.getCell(legendRowIdx, 1).font = { italic: true, bold: true };
        ws.getCell(legendRowIdx + 1, 1).value = 'RTU = nilai availability TERTINGGI di antara semua titik (mewakili status alat komunikasi/RTU induk)';
        ws.getCell(legendRowIdx + 1, 1).font = { italic: true };
        tagsOrder.forEach((tag, i) => {
            ws.getCell(legendRowIdx + 2 + i, 1).value = `PT${i + 1}`;
            ws.getCell(legendRowIdx + 2 + i, 2).value = tag;
        });

        ws.columns.forEach(c => c.width = 14);
        ws.getColumn(1).width = 14;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = sourcesWithData.length === 2 ? 'Laporan_Pressure_Semua_Sumber.xlsx' : `Laporan_Pressure_${pLabel(sourcesWithData[0])}.xlsx`;
    downloadPressureBlob(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

document.getElementById('press-export-excel-btn').addEventListener('click', async () => {
    const availableSources = ['Mobilkom', 'Partner'].filter(s => pressureState.sources[s].length > 0);
    if (availableSources.length === 0) { alert('Belum ada data untuk di-export.'); return; }

    const choice = document.getElementById('press-export-source-select').value;
    let sourcesWithData;
    if (choice === 'ALL') sourcesWithData = availableSources;
    else if (availableSources.includes(choice)) sourcesWithData = [choice];
    else { alert(`Data ${pLabel(choice)} belum ada.`); return; }

    await runPressureExcelExport(sourcesWithData);
});

function downloadPressureBlob(buffer, filename, mime) {
    const blob = new Blob([buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ---------------------- EXPORT PDF (TABEL DETAIL) ----------------------
document.getElementById('press-export-pdf-btn').addEventListener('click', () => {
    const data = sortPressureData(getFilteredPressureData());
    if (data.length === 0) { alert('Tidak ada data untuk di-export.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14); doc.setTextColor(10, 44, 92);
    doc.text('PRESSURE DATA AVAILABILITY REPORT', 148, 12, { align: 'center' });
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text('PT MOBILKOM TELEKOMINDO', 148, 18, { align: 'center' });
    doc.autoTable({
        startY: 24,
        head: [['Sumber', 'Titik', 'Tanggal', 'Menit Terdata', 'Availability', 'Status', 'Avg Pressure']],
        body: data.map(r => [pLabel(r.source), r.tag, r.date, `${r.rowCount}/${r.slotsPerDay}`, r.availability.toFixed(2) + '%', r.status === 1 ? 'Bisa Ditagih' : 'Belum Bisa Ditagih', r.avgValue.toFixed(3)]),
        headStyles: { fillColor: [10, 44, 92], textColor: 255, fontStyle: 'bold' },
        didParseCell: h => { if (h.section === 'body') { const row = data[h.row.index]; h.cell.styles.fillColor = row.status === 1 ? [200, 230, 201] : [255, 205, 210]; } },
        styles: { fontSize: 8 }
    });
    doc.save('Laporan_Pressure.pdf');
});

// ---------------------- EXPORT PERBANDINGAN ----------------------
document.getElementById('press-comp-export-excel').addEventListener('click', async () => {
    const rows = getComparisonRows();
    if (rows.length === 0) { alert('Tidak ada data perbandingan untuk di-export.'); return; }
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Perbandingan');
    ws.mergeCells('A1:I1');
    ws.getCell('A1').value = `PERBANDINGAN ${pLabel('Mobilkom').toUpperCase()} vs ${pLabel('Partner').toUpperCase()}`;
    ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF0A2C5C' } };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.getRow(3).values = ['Titik', 'Tanggal', `Availability ${pLabel('Mobilkom')}`, `Availability ${pLabel('Partner')}`, 'Selisih', `Avg ${pLabel('Mobilkom')}`, `Avg ${pLabel('Partner')}`, 'Selisih Avg', 'Verifikasi'];
    ws.getRow(3).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2C5C' } }; cell.alignment = { horizontal: 'center', wrapText: true }; });
    rows.forEach((r, i) => {
        const rowIdx = 4 + i;
        const row = ws.getRow(rowIdx);
        const cocok = r.statusA === r.statusB;
        const diffAvail = r.availA - r.availB;
        const diffAvg = r.avgA - r.avgB;
        row.values = [r.tag, r.date, r.availA, r.availB, diffAvail, r.avgA, r.avgB, diffAvg, cocok ? '✅ Cocok' : '⚠️ Perlu Ditinjau'];
        row.getCell(3).numFmt = '0.00"%"'; row.getCell(4).numFmt = '0.00"%"';
        row.getCell(5).numFmt = '0.00"%"';
        row.getCell(8).numFmt = '#,##0.000';
        if (!cocok) row.eachCell(cell => cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } });
    });
    ws.columns.forEach(c => c.width = 20);
    const buffer = await workbook.xlsx.writeBuffer();
    downloadPressureBlob(buffer, 'Perbandingan_Pressure.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

document.getElementById('press-comp-export-pdf').addEventListener('click', () => {
    const rows = getComparisonRows();
    if (rows.length === 0) { alert('Tidak ada data perbandingan untuk di-export.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(13); doc.setTextColor(10, 44, 92);
    doc.text(`PERBANDINGAN ${pLabel('Mobilkom').toUpperCase()} vs ${pLabel('Partner').toUpperCase()}`, 148, 15, { align: 'center' });
    doc.autoTable({
        startY: 22,
        head: [['Titik', 'Tanggal', `Avail. ${pLabel('Mobilkom')}`, `Avail. ${pLabel('Partner')}`, 'Selisih', `Avg ${pLabel('Mobilkom')}`, `Avg ${pLabel('Partner')}`, 'Selisih Avg', 'Verifikasi']],
        body: rows.map(r => [r.tag, r.date, r.availA.toFixed(2) + '%', r.availB.toFixed(2) + '%', (r.availA - r.availB).toFixed(2) + '%', r.avgA.toFixed(3), r.avgB.toFixed(3), (r.avgA - r.avgB).toFixed(3), r.statusA === r.statusB ? 'Cocok' : 'Perlu Ditinjau']),
        headStyles: { fillColor: [10, 44, 92], textColor: 255, fontStyle: 'bold' },
        didParseCell: h => { if (h.section === 'body' && rows[h.row.index].statusA !== rows[h.row.index].statusB) h.cell.styles.fillColor = [255, 205, 210]; },
        styles: { fontSize: 8 }
    });
    doc.save('Perbandingan_Pressure.pdf');
});

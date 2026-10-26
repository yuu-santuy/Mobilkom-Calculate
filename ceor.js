/**
 * CEOR Data Web Application - Logic Script
 * File Name: ceor.js
 * Description: Core logic for parsing CSV/XLS/XLSX, calculating CEOR parameters,
 *              filtering, rendering UI, and exporting to Excel & PDF.
 */

(() => {

// ==========================================
// 1. STATE MANAGEMENT
// ==========================================
const CEOR_APP = {
    // Array penampung seluruh raw data bertipe: { nodeId, rawDate, dateKey, minuteKey, pressure, flow }
    rawRecords: [],
    
    // Array penampung hasil kalkulasi harian per NodeId & DateKey
    calculatedResults: [],
    
    // Array penampung hasil harian yang sedang ditampilkan (setelah filter)
    filteredResults: [],

    // Array penampung hasil ringkasan per NodeId & Periode/Bulan (6 Kolom)
    summaryResults: [],

    // Array penampung hasil ringkasan yang sedang ditampilkan (setelah filter)
    filteredSummaryResults: [],
    
    // State Filter Aktif
    filters: {
        nodeId: '',
        startDate: '',
        endDate: ''
    }
};

// Constant total data per hari (24 Jam x 60 Menit)
const CONSTANT_TOTAL_DATA = 1440;

// Daftar nama bulan dalam Bahasa Indonesia
const INDO_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Format string tanggal atau YYYY-MM menjadi "Bulan Tahun" (Contoh: "Agustus 2026")
 */
function formatPeriodeBulan(dateStr) {
    if (!dateStr || dateStr === 'UNKNOWN') return '-';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        if (monthNum >= 1 && monthNum <= 12) {
            return `${INDO_MONTHS[monthNum - 1]} ${year}`;
        }
    }
    return dateStr;
}

const CEOR_WELLPAD_MASTER = {
    'Wellpad 1': ['8D-57', '8D-56', '8D-46', '8D-47', '8D-47E1', '8D-47E', '8D-47E1EXT'],
    'Wellpad 2': ['8D-47E2', '8D-47E2EXT'],
    'Wellpad 3': ['8D-55E', '8D-56E', '8D-56N2'],
    'Wellpad 4': ['8D-56N', '8D-57N', '8D-55N'],
    'Wellpad 5': ['8D-66N1', '8D-66N'],
    'Wellpad 6': ['8D-47N1', '8D-47N2', '8D-56N1']
};

const CEOR_WELLPAD_LOOKUP = Object.entries(CEOR_WELLPAD_MASTER).reduce((acc, [wellpadName, nodeList]) => {
    nodeList.forEach((nodeId) => {
        const clean = normalizeNodeId(nodeId).toUpperCase();
        if (clean) acc[clean] = wellpadName;
    });
    return acc;
}, {});

function normalizeNodeId(rawNodeId) {
    if (rawNodeId === null || rawNodeId === undefined) return '';
    let value = String(rawNodeId).trim();
    value = value.replace(/\s+/g, '');
    value = value.replace(/EXT$/i, '');
    return value;
}

function extractNodeGroupKey(nodeId) {
    const clean = normalizeNodeId(nodeId);
    if (!clean) return 'UNKNOWN';
    return clean;
}

function formatWellpadName(wellpadName) {
    if (!wellpadName || wellpadName === 'Wellpad UNKNOWN') return 'OPM-Wellpad (Unassigned)';

    const match = wellpadName.match(/(\d+)/);
    if (match) return `OPM-Wellpad ${match[1]}`;
    return `OPM-${wellpadName}`;
}

function detectWellpad(nodeId) {
    const clean = normalizeNodeId(nodeId).toUpperCase();
    if (!clean) return 'Wellpad UNKNOWN';

    const matched = CEOR_WELLPAD_LOOKUP[clean];
    if (matched) return matched;

    // Fallback: cek apakah nodeId ada suffix huruf yang bisa mengidentifikasi wellpad lain
    // Jika tidak ditemukan di lookup, assign ke wellpad baru berdasarkan urutan unik
    return 'Wellpad UNKNOWN';
}

function buildWellpadGroups(records) {
    const grouped = new Map();

    const uniqueNodeIds = [...new Set((records || []).map((row) => normalizeNodeId(row.nodeId)).filter(Boolean))];

    uniqueNodeIds.forEach((nodeId) => {
        const wellpad = detectWellpad(nodeId);
        if (!grouped.has(wellpad)) {
            grouped.set(wellpad, new Set());
        }
        grouped.get(wellpad).add(nodeId);
    });

    return [...grouped.entries()]
        .map(([wellpad, nodeSet]) => ({
            wellpad,
            label: formatWellpadName(wellpad),
            nodeIds: [...nodeSet].sort((a, b) => {
                const aNum = parseInt(String(a).match(/(\d+)/)?.[1] || '0', 10);
                const bNum = parseInt(String(b).match(/(\d+)/)?.[1] || '0', 10);
                if (aNum !== bNum) return aNum - bNum;
                return String(a).localeCompare(String(b));
            })
        }))
        .sort((a, b) => {
            const aNum = parseInt(String(a.wellpad).match(/(\d+)/)?.[1] || '9999', 10);
            const bNum = parseInt(String(b.wellpad).match(/(\d+)/)?.[1] || '9999', 10);
            return aNum - bNum;
        });
}

// ==========================================
// 2. DOM CONTENT LOADED & INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    ceorInitEventListeners();
    ceorUpdateUIState();
});

/**
 * Inisialisasi seluruh event listener DOM
 */
function ceorInitEventListeners() {
    // 1. File Upload (New / Replace)
    const fileInputNew = document.getElementById('fileInputNew');
    if (fileInputNew) {
        fileInputNew.addEventListener('change', (e) => ceorHandleFileUpload(e, false));
    }

    // 2. File Upload (Append / Tambah Data)
    const fileInputAppend = document.getElementById('fileInputAppend');
    if (fileInputAppend) {
        fileInputAppend.addEventListener('change', (e) => ceorHandleFileUpload(e, true));
    }

    // 3. Drag & Drop Zone
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-primary', 'bg-light');
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary', 'bg-light');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary', 'bg-light');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                ceorProcessFiles(e.dataTransfer.files, false);
            }
        });
    }

    // 4. Tombol Filter
    const btnApplyFilter = document.getElementById('btnApplyFilter');
    if (btnApplyFilter) {
        btnApplyFilter.addEventListener('click', ceorApplyFilters);
    }

    const btnResetFilter = document.getElementById('btnResetFilter');
    if (btnResetFilter) {
        btnResetFilter.addEventListener('click', ceorResetFilters);
    }

    // Filter realtime pada input Node ID
    const filterNodeId = document.getElementById('filterNodeId');
    const filterNodeIdSelect = document.getElementById('filterNodeIdSelect');

    if (filterNodeIdSelect) {
        filterNodeIdSelect.addEventListener('change', () => {
            if (filterNodeIdSelect.value && filterNodeId) {
                filterNodeId.value = '';
            }
            ceorApplyFilters();
        });
    }

    if (filterNodeId) {
        filterNodeId.addEventListener('input', () => {
            if (filterNodeId.value && filterNodeIdSelect) {
                filterNodeIdSelect.value = '';
            }
            ceorApplyFilters();
        });
    }

    const filterStartDate = document.getElementById('filterStartDate');
    if (filterStartDate) {
        filterStartDate.addEventListener('change', ceorApplyFilters);
    }

    const filterEndDate = document.getElementById('filterEndDate');
    if (filterEndDate) {
        filterEndDate.addEventListener('change', ceorApplyFilters);
    }

    // 5. Tombol Export
    const btnExportExcel = document.getElementById('btnExportExcel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', ceorExportToExcel);
    }

    const btnExportPdf = document.getElementById('btnExportPdf');
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', ceorExportToPDF);
    }

    // 6. Tombol Clear / Reset Data
    const btnClearData = document.getElementById('btnClearData');
    if (btnClearData) {
        btnClearData.addEventListener('click', ceorClearAllData);
    }
}

// ==========================================
// 3. FILE PARSING & DATA HANDLING
// ==========================================

/**
 * Handler utama saat file diunggah
 * @param {Event} event 
 * @param {boolean} isAppend - true jika menambahkan data, false jika replace data baru
 */
function ceorHandleFileUpload(event, isAppend = false) {
    const files = Array.from(event.target.files || []);
    // Reset file input agar file yang sama bisa diunggah ulang jika perlu
    event.target.value = '';

    if (files.length === 0) return;
    
    ceorProcessFiles(files, isAppend);
}

/**
 * Memproses satu atau beberapa file (CSV, XLS, XLSX)
 */
async function ceorProcessFiles(files, isAppend = false) {
    ceorShowLoading(true, "Membaca dan memproses file data...");

    // Beri jeda singkat agar browser dapat merender loading overlay
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        if (!isAppend) {
            CEOR_APP.rawRecords = [];
        }

        let newRecordsCount = 0;
        const allNormalizations = {}; // [FIX 2] kumpulan semua normalisasi dari semua file

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const { records, normalizationMap } = await ceorReadSingleFile(file);
                CEOR_APP.rawRecords = CEOR_APP.rawRecords.concat(records);
                newRecordsCount += records.length;
                Object.assign(allNormalizations, normalizationMap);
            } catch (error) {
                console.error(`Gagal membaca file ${file.name}:`, error);
                alert(`Terjadi kesalahan saat membaca file ${file.name}: ${error.message}`);
            }
        }

        if (newRecordsCount > 0) {
            // Lakukan kalkulasi CEOR
            ceorRecalculateCEOR();
            ceorPopulateNodeIdDropdown();
            ceorApplyFilters();
            ceorShowNotification(`Berhasil memproses ${newRecordsCount} baris data mentah.`, 'success');

            // [FIX 2] Tampilkan notifikasi normalisasi NodeID kalau ada
            const normEntries = Object.entries(allNormalizations);
            if (normEntries.length > 0) {
                const list = normEntries.map(([raw, fixed]) => `"${raw}" → "${fixed}"`).join(', ');
                ceorShowNotification(`ℹ️ ${normEntries.length} NodeID dinormalisasi (suffix EXT dilepas): ${list}`, 'info');
            }
        } else {
            ceorShowNotification('Tidak ada data valid yang dapat diproses.', 'warning');
        }
    } catch (error) {
        console.error('Terjadi kesalahan saat memproses data:', error);
        ceorShowNotification('Terjadi kesalahan saat memproses file data.', 'danger');
    } finally {
        ceorShowLoading(false);
    }
}

/**
 * Membaca single file menggunakan SheetJS (XLSX library)
 */
function ceorReadSingleFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                // Ambil sheet pertama
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Konversi sheet ke JSON 2D Array
                const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

                if (!rawJson || rawJson.length < 2) {
                    return resolve([]);
                }

                // 1. Deteksi Kolom Header
                const headerRow = rawJson[0];
                const colIndexes = ceorDetectHeaderColumns(headerRow);

                if (colIndexes.nodeId === -1 || colIndexes.tanggal === -1) {
                    throw new Error("Kolom 'NodeID' dan 'Tanggal' tidak ditemukan pada header file.");
                }

                // 2. Parse Baris Data Mentah
                const records = [];
                const normalizationMap = {}; // [FIX 2] raw NodeID → normalized NodeID
                for (let r = 1; r < rawJson.length; r++) {
                    const row = rawJson[r];
                    if (!row || row.length === 0) continue;

                    const rawNodeId = row[colIndexes.nodeId];
                    const rawTanggal = row[colIndexes.tanggal];
                    const rawPress = colIndexes.pressure !== -1 ? row[colIndexes.pressure] : null;
                    const rawFlow = colIndexes.flow !== -1 ? row[colIndexes.flow] : null;

                    // Validasi minimal NodeID dan Tanggal
                    if (rawNodeId !== null && rawNodeId !== undefined && rawTanggal !== null && rawTanggal !== undefined) {
                        const rawIdStr = String(rawNodeId).trim();
                        const nodeIdStr = normalizeNodeId(rawNodeId);
                        if (nodeIdStr === '') continue;

                        // [FIX 2] Catat NodeID yang dinormalisasi (EXT distrip)
                        if (rawIdStr !== nodeIdStr && !normalizationMap[rawIdStr]) {
                            normalizationMap[rawIdStr] = nodeIdStr;
                        }

                        const { dateKey, minuteKey } = ceorExtractDateTimeKeys(rawTanggal);
                        const numPress = parseNumeric(rawPress);
                        const numFlow = parseNumeric(rawFlow);

                        records.push({
                            nodeId: nodeIdStr,
                            rawDate: String(rawTanggal).trim(),
                            dateKey: dateKey,
                            minuteKey: minuteKey,
                            pressure: numPress,
                            flow: numFlow
                        });
                    }
                }

                resolve({ records, normalizationMap });

            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Deteksi posisi kolom berdasarkan variasi nama header
 */
function ceorDetectHeaderColumns(headerRow) {
    const colMap = {
        nodeId: -1,
        tanggal: -1,
        pressure: -1,
        flow: -1
    };

    headerRow.forEach((col, idx) => {
        if (!col) return;
        const name = String(col).trim().toLowerCase().replace(/[\s_]+/g, '');

        // Node ID match
        if (['nodeid', 'node', 'wellname', 'well'].includes(name) || name.includes('nodeid')) {
            colMap.nodeId = idx;
        }
        // Tanggal / Date match
        else if (['tanggal', 'tgl', 'date', 'datetime', 'scantime', 'timestamp', 'time'].includes(name) || name.includes('tanggal')) {
            colMap.tanggal = idx;
        }
        // Pressure match
        else if (['pressure', 'press', 'tekanan', 'pressure1', 'press1'].includes(name) || name.includes('pressure')) {
            colMap.pressure = idx;
        }
        // Flow match
        else if (['flow', 'flowrate', 'debit', 'flow1'].includes(name) || name.includes('flow')) {
            colMap.flow = idx;
        }
    });

    return colMap;
}

/**
 * Helper memparsing nilai numerik (mengembalikan null jika NaN / NULL / Kosong)
 */
function parseNumeric(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    
    const str = String(val).trim().toUpperCase();
    if (str === '' || str === 'NULL' || str === 'NAN' || str === 'NONE' || str === '-') return null;
    
    const parsed = parseFloat(str.replace(',', '.'));
    return isNaN(parsed) ? null : parsed;
}

/**
 * Ekstrak format Tanggal (YYYY-MM-DD) dan Menit (YYYY-MM-DD HH:mm)
 */
function ceorExtractDateTimeKeys(rawVal) {
    if (!rawVal) return { dateKey: 'UNKNOWN', minuteKey: 'UNKNOWN' };

    // Jika berupa Date Object dari SheetJS
    if (rawVal instanceof Date) {
        const y = rawVal.getFullYear();
        const m = String(rawVal.getMonth() + 1).padStart(2, '0');
        const d = String(rawVal.getDate()).padStart(2, '0');
        const hh = String(rawVal.getHours()).padStart(2, '0');
        const mm = String(rawVal.getMinutes()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;
        return {
            dateKey: dateKey,
            minuteKey: `${dateKey} ${hh}:${mm}`
        };
    }

    const str = String(rawVal).trim();
    // Bisa dipisah spasi atau 'T', misal "8/13/2026 0:01" atau "2026-08-13T00:01:00"
    const parts = str.split(/[\sT]+/);
    const datePart = parts[0] || '';
    const timePart = parts[1] || '';

    let dateKey = datePart;

    if (datePart.includes('/')) {
        const p = datePart.split('/');
        if (p.length === 3) {
            let y = p[2];
            let m = p[0];
            let d = p[1];

            if (p[0].length === 4) {
                y = p[0];
                m = p[1];
                d = p[2];
            } else if (parseInt(p[0], 10) > 12) {
                d = p[0];
                m = p[1];
            }

            m = String(m).padStart(2, '0');
            d = String(d).padStart(2, '0');
            dateKey = `${y}-${m}-${d}`;
        }
    } else if (datePart.includes('-')) {
        const p = datePart.split('-');
        if (p.length === 3 && p[0].length === 4) {
            const y = p[0];
            const m = String(p[1]).padStart(2, '0');
            const d = String(p[2]).padStart(2, '0');
            dateKey = `${y}-${m}-${d}`;
        }
    }

    let hh = '00';
    let mm = '00';
    if (timePart) {
        const tp = timePart.split(':');
        if (tp.length >= 2) {
            hh = String(parseInt(tp[0], 10) || 0).padStart(2, '0');
            mm = String(parseInt(tp[1], 10) || 0).padStart(2, '0');
        }
    }

    return {
        dateKey: dateKey,
        minuteKey: `${dateKey} ${hh}:${mm}`
    };
}

/**
 * Helper kompatibilitas untuk ambil Tanggal saja (YYYY-MM-DD)
 */
function extractDateKey(rawVal) {
    return ceorExtractDateTimeKeys(rawVal).dateKey;
}


// ==========================================
// 4. CEOR CALCULATION ENGINE
// ==========================================

/**
 * Menghitung ulang seluruh data CEOR dari rawRecords
 * Agregasi per NodeID + Tanggal (DateKey) dengan Unique Minute Binning & Capping 100%
 */
function ceorRecalculateCEOR() {
    const groups = new Map();

    // 1. Grouping data per NodeID + DateKey & Deduplikasi per Menit (YYYY-MM-DD HH:mm)
    CEOR_APP.rawRecords.forEach(rec => {
        if (!rec.nodeId || !rec.dateKey || rec.dateKey === 'UNKNOWN') return;

        const groupKey = `${rec.nodeId}||${rec.dateKey}`;
        let group = groups.get(groupKey);
        if (!group) {
            group = {
                nodeId: rec.nodeId,
                dateKey: rec.dateKey,
                minuteBins: new Map() // minuteKey -> { pressure, flow }
            };
            groups.set(groupKey, group);
        }

        // Cek validitas data: minimal nilai Pressure atau Flow ada dan valid numerik
        const hasValidPressure = rec.pressure !== null && !isNaN(rec.pressure);
        const hasValidFlow = rec.flow !== null && !isNaN(rec.flow);

        if (hasValidPressure || hasValidFlow) {
            const minKey = rec.minuteKey || `${rec.dateKey} 00:00`;
            let bin = group.minuteBins.get(minKey);
            if (!bin) {
                // Catat menit baru (1 menit = 1 data point)
                group.minuteBins.set(minKey, {
                    pressure: hasValidPressure ? rec.pressure : null,
                    flow: hasValidFlow ? rec.flow : null
                });
            } else {
                // Duplikat di menit yang sama: lengkapi field yang sebelumnya null jika baris ini ada nilainya
                if (bin.pressure === null && hasValidPressure) {
                    bin.pressure = rec.pressure;
                }
                if (bin.flow === null && hasValidFlow) {
                    bin.flow = rec.flow;
                }
            }
        }
    });

    // 2. Kalkulasi Metrik per Group (NodeID + Tanggal)
    const results = [];

    groups.forEach(group => {
        const totalData = CONSTANT_TOTAL_DATA; // 1440 menit

        // good_data = jumlah menit unik yang memiliki data valid (maksimal 1440)
        const uniqueValidMinutes = group.minuteBins.size;
        const goodData = Math.min(uniqueValidMinutes, totalData);

        // availability = (good_data / 1440) * 100 (clamp/cap maksimal 100%)
        const rawAvail = (goodData / totalData) * 100;
        const availability = Math.min(Math.max(rawAvail, 0), 100);

        // Rata-rata telemetri dihitung dari data per menit yang telah di-deduplikasi
        let sumPressure = 0;
        let countPressure = 0;
        let sumFlow = 0;
        let countFlow = 0;

        group.minuteBins.forEach(bin => {
            if (bin.pressure !== null && !isNaN(bin.pressure)) {
                sumPressure += bin.pressure;
                countPressure++;
            }
            if (bin.flow !== null && !isNaN(bin.flow)) {
                sumFlow += bin.flow;
                countFlow++;
            }
        });

        const avgPressure = countPressure > 0 ? (sumPressure / countPressure) : null;
        const avgFlow = countFlow > 0 ? (sumFlow / countFlow) : null;

        const availabilityAccept = availability >= 90 ? 1 : 0;

        // Cascading Rule: bila availability accept = 0, maka paksa press/flow = 0.
        const press1 = (availabilityAccept === 1 && avgPressure !== null) ? 1 : 0;
        const flow1 = (availabilityAccept === 1 && avgFlow !== null) ? 1 : 0;

        const pressAvail = (countPressure / totalData) * 100;
        const flowAvail = (countFlow / totalData) * 100;

        results.push({
            nodeId: group.nodeId,
            rtuType: detectWellpad(group.nodeId),
            tgl: group.dateKey,
            totalData: totalData,
            goodData: goodData,
            goodPressure: countPressure,
            goodFlow: countFlow,
            pressAvail: Math.min(Math.max(pressAvail, 0), 100),
            flowAvail: Math.min(Math.max(flowAvail, 0), 100),
            avgPressure: avgPressure,
            avgFlow: avgFlow,
            availability: availability,
            availabilityAccept: availabilityAccept,
            press1: press1,
            flow1: flow1
        });
    });

    // Urutkan berdasarkan NodeID lalu Tanggal
    results.sort((a, b) => {
        if (a.nodeId === b.nodeId) {
            return a.tgl.localeCompare(b.tgl);
        }
        return a.nodeId.localeCompare(b.nodeId);
    });

    CEOR_APP.calculatedResults = results;
    CEOR_APP.summaryResults = ceorCalculateSummaryResults(results);
}

/**
 * Menghitung Agregasi Ringkasan (Summary) per Node ID & Periode/Bulan
 * Hanya berisi 6 Kolom: Node ID, Periode/Bulan, Total Hari, Availability (%), Accept Press, Accept Flow
 */
function ceorCalculateSummaryResults(dailyRecords) {
    const summaryMap = new Map();

     dailyRecords.forEach(row => {
        const monthKey = row.tgl && row.tgl.length >= 7 ? row.tgl.slice(0, 7) : 'UNKNOWN';
        const key = `${row.nodeId}||${monthKey}`;

        if (!summaryMap.has(key)) {
            summaryMap.set(key, {
                nodeId: row.nodeId,
                rtuType: detectWellpad(row.nodeId),
                monthKey: monthKey,
                periode: formatPeriodeBulan(row.tgl),
                totalHari: 0,
                totalAccept: 0,
                sumAvail: 0,
                acceptPress: 0,
                acceptFlow: 0
            });
        }

        const item = summaryMap.get(key);
        item.totalHari += 1;
        item.sumAvail += Math.min(Math.max(row.availability, 0), 100);
        item.rtuType = detectWellpad(row.nodeId);

        if (row.availability >= 90) {
            item.totalAccept += 1;
        }

        if (row.press1 === 1) {
            item.acceptPress += 1;
        }

        if (row.flow1 === 1) {
            item.acceptFlow += 1;
        }
    });

    const summaryList = [];
    summaryMap.forEach(item => {
        const avgAvail = item.totalHari > 0 ? (item.sumAvail / item.totalHari) : 0;
        summaryList.push({
            nodeId: item.nodeId,
            rtuType: item.rtuType,
            rtuTypeLabel: formatWellpadName(item.rtuType),
            periode: item.periode,
            monthKey: item.monthKey,
            totalHari: item.totalHari,
            availability: Math.min(Math.max(avgAvail, 0), 100),
            availabilityAccept: item.totalAccept,
            acceptPress: item.acceptPress,
            acceptFlow: item.acceptFlow
        });
    });

    // Urutkan berdasarkan Node ID lalu Periode/Bulan
    summaryList.sort((a, b) => {
        if (a.nodeId === b.nodeId) {
            return a.monthKey.localeCompare(b.monthKey);
        }
        return a.nodeId.localeCompare(b.nodeId);
    });

    return summaryList;
}


// ==========================================
// 5. FILTERING & DROPDOWN POPULATION
// ==========================================

/**
 * Mengisi dropdown filter Node ID dengan opsi unik
 */
function ceorPopulateNodeIdDropdown() {
    const selectNodeId = document.getElementById('filterNodeIdSelect');
    if (!selectNodeId) return;

    // Ambil daftar NodeID unik
    const uniqueNodes = Array.from(new Set(CEOR_APP.calculatedResults.map(r => r.nodeId))).sort();

    selectNodeId.innerHTML = '<option value="">-- Semua Node ID --</option>';
    uniqueNodes.forEach(node => {
        const opt = document.createElement('option');
        opt.value = node;
        opt.textContent = node;
        selectNodeId.appendChild(opt);
    });
}

/**
 * Menerapkan Filter pada data kalkulasi CEOR
 */
function ceorApplyFilters() {
    const textNodeId = (document.getElementById('filterNodeId')?.value || '').trim().toLowerCase();
    const selectNodeId = (document.getElementById('filterNodeIdSelect')?.value || '').trim().toLowerCase();
    const startDate = document.getElementById('filterStartDate')?.value || '';
    const endDate = document.getElementById('filterEndDate')?.value || '';

    const targetNodeId = selectNodeId || textNodeId;

    CEOR_APP.filteredResults = CEOR_APP.calculatedResults.filter(row => {
        // Filter Node ID
        if (targetNodeId && !row.nodeId.toLowerCase().includes(targetNodeId)) {
            return false;
        }

        // Filter Tanggal
        if (startDate && row.tgl < startDate) {
            return false;
        }
        if (endDate && row.tgl > endDate) {
            return false;
        }

        return true;
    });

    // Update ringkasan summary 6 kolom sesuai hasil filter aktif
    CEOR_APP.filteredSummaryResults = ceorCalculateSummaryResults(CEOR_APP.filteredResults);

    ceorRenderSummaryTable();
    ceorRenderTable();
    ceorUpdateSummaryCards();
    ceorUpdateUIState();
}

/**
 * Reset seluruh filter ke kondisi awal
 */
function ceorResetFilters() {
    if (document.getElementById('filterNodeId')) document.getElementById('filterNodeId').value = '';
    if (document.getElementById('filterNodeIdSelect')) document.getElementById('filterNodeIdSelect').value = '';
    if (document.getElementById('filterStartDate')) document.getElementById('filterStartDate').value = '';
    if (document.getElementById('filterEndDate')) document.getElementById('filterEndDate').value = '';

    ceorApplyFilters();
}


// ==========================================
// 6. UI RENDERING & SUMMARY CARDS
// ==========================================

/**
 * Memperbarui Tampilan Tabel Ringkasan (Summary) 6 Kolom
 */
function ceorRenderSummaryTable() {
    const tbody = document.getElementById('ceorSummaryTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (CEOR_APP.filteredSummaryResults.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                    Tidak ada data ringkasan CEOR yang cocok dengan kriteria filter.
                </td>
            </tr>`;
        const summaryInfo = document.getElementById('summaryTableInfo');
        if (summaryInfo) summaryInfo.textContent = 'Menampilkan 0 ringkasan node/periode.';
        return;
    }

    const fragment = document.createDocumentFragment();

    CEOR_APP.filteredSummaryResults.forEach(row => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td class="fw-semibold text-primary">${escapeHtml(row.nodeId)}</td>
            <td class="fw-medium">${escapeHtml(row.rtuTypeLabel || formatWellpadName(row.rtuType))}</td>
            <td class="fw-medium">${escapeHtml(row.periode)}</td>
            <td class="text-center fw-semibold">${row.totalHari}</td>
            <td class="text-center fw-bold text-info">${row.availabilityAccept}</td>
            <td class="text-center fw-bold text-success">${row.acceptPress}</td>
            <td class="text-center fw-bold text-success">${row.acceptFlow}</td>
        `;

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    const summaryInfo = document.getElementById('summaryTableInfo');
    if (summaryInfo) {
        summaryInfo.textContent = `Menampilkan ${CEOR_APP.filteredSummaryResults.length} ringkasan node/periode.`;
    }
}

/**
 * Memperbarui Tampilan Tabel Utama (Detail Data Harian)
 */
function ceorRenderTable() {
    const tbody = document.getElementById('ceorTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (CEOR_APP.filteredResults.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                    Tidak ada data CEOR yang cocok dengan kriteria filter.
                </td>
            </tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    CEOR_APP.filteredResults.forEach((row) => {
        const tr = document.createElement('tr');

        const strAvgPress = (row.avgPressure !== null) ? row.avgPressure.toFixed(2) : "NULL";
        const strAvgFlow = (row.avgFlow !== null) ? row.avgFlow.toFixed(2) : "NULL";
        const strAvail = row.availability.toFixed(2) + '%';

        const press1Badge = row.press1 === 1 
            ? '<span class="badge bg-success px-3 py-2">1</span>' 
            : '<span class="badge bg-secondary px-3 py-2">0</span>';

        const flow1Badge = row.flow1 === 1 
            ? '<span class="badge bg-success px-3 py-2">1</span>' 
            : '<span class="badge bg-secondary px-3 py-2">0</span>';

        tr.innerHTML = `
            <td class="fw-semibold text-primary">${escapeHtml(row.nodeId)}</td>
            <td>${escapeHtml(row.tgl)}</td>
            <td class="text-center fw-semibold">${row.totalData}</td>
            <td class="text-center fw-semibold text-info-emphasis">${row.goodData}</td>
            <td class="text-end font-monospace">${strAvgPress !== "NULL" ? strAvgPress : '<span class="text-muted">NULL</span>'}</td>
            <td class="text-end font-monospace">${strAvgFlow !== "NULL" ? strAvgFlow : '<span class="text-muted">NULL</span>'}</td>
            <td class="text-center"><span class="badge bg-light text-dark border fs-6">${strAvail}</span></td>
            <td class="text-center fw-bold text-info">${row.availabilityAccept}</td>
            <td class="text-center">${press1Badge}</td>
            <td class="text-center">${flow1Badge}</td>
        `;

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    // Update info jumlah data terfilter
    const tableInfo = document.getElementById('tableInfo');
    if (tableInfo) {
        tableInfo.textContent = `Menampilkan ${CEOR_APP.filteredResults.length} dari total ${CEOR_APP.calculatedResults.length} baris data harian.`;
    }
}

/**
 * Memperbarui Kartu Ringkasan Statistik (Summary Cards)
 */
function ceorUpdateSummaryCards() {
    const statTotalNodes = document.getElementById('statTotalNodes');
    const statTotalDays = document.getElementById('statTotalDays');
    const statTotalRows = document.getElementById('statTotalRows');
    const statAvgAvailability = document.getElementById('statAvgAvailability');

    const data = CEOR_APP.filteredResults;

    if (data.length === 0) {
        if (statTotalNodes) statTotalNodes.textContent = '0';
        if (statTotalDays) statTotalDays.textContent = '0';
        if (statTotalRows) statTotalRows.textContent = '0';
        if (statAvgAvailability) statAvgAvailability.textContent = '0.00%';
        return;
    }

    const uniqueNodes = new Set(data.map(d => d.nodeId)).size;
    const uniqueDays = new Set(data.map(d => d.tgl)).size;
    const totalRawRows = CEOR_APP.rawRecords.length;

    const totalAvail = data.reduce((sum, row) => sum + Math.min(Math.max(row.availability, 0), 100), 0);
    const avgAvail = data.length > 0 ? Math.min(totalAvail / data.length, 100) : 0;

    if (statTotalNodes) statTotalNodes.textContent = uniqueNodes.toLocaleString();
    if (statTotalDays) statTotalDays.textContent = uniqueDays.toLocaleString();
    if (statTotalRows) statTotalRows.textContent = totalRawRows.toLocaleString();
    if (statAvgAvailability) statAvgAvailability.textContent = avgAvail.toFixed(2) + '%';
}

/**
 * Mengatur visibilitas elemen UI berdasarkan status ketersediaan data
 */
function ceorUpdateUIState() {
    const hasData = CEOR_APP.calculatedResults.length > 0;

    const emptyState = document.getElementById('emptyState');
    const resultsSection = document.getElementById('resultsSection');

    if (emptyState) emptyState.style.display = hasData ? 'none' : 'block';
    if (resultsSection) resultsSection.style.display = hasData ? 'block' : 'none';
}

/**
 * Menghapus seluruh data di aplikasi
 */
function ceorClearAllData() {
    if (confirm('Apakah Anda yakin ingin menghapus seluruh data yang diunggah?')) {
        CEOR_APP.rawRecords = [];
        CEOR_APP.calculatedResults = [];
        CEOR_APP.filteredResults = [];
        CEOR_APP.summaryResults = [];
        CEOR_APP.filteredSummaryResults = [];
        ceorPopulateNodeIdDropdown();
        ceorResetFilters();
        ceorUpdateUIState();
        ceorShowNotification('Seluruh data berhasil dibersihkan.', 'info');
    }
}


// ==========================================
// 7. EXPORT FUNCTIONALITY (EXCEL & PDF)
// ==========================================

/**
 * Export Hasil Tabel CEOR ke Format Excel (.xlsx)
 * Menghasilkan 2 Sheet:
 * - Sheet 1: "Summary" (Tabel Ringkasan 6 Kolom: Node ID, Periode/Bulan, Total Hari, Availability (%), Accept Press, Accept Flow)
 * - Sheet 2: "Detail Data" (Rincian Data Harian per Tanggal)
 *
 * Catatan: bagian logika perhitungan tidak diubah. Hanya logika export ke Excel
 * yang diperbarui agar tampilannya sesuai referensi: header biru, isi putih, dan
 * baris bergantian dengan warna biru muda agar lebih rapi.
 */
function ceorApplyCeorSheetStyle(worksheet, columnWidths) {
    worksheet.columns = columnWidths.map((width, index) => ({
        key: String(index),
        width,
        style: {
            border: {
                top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
            },
            alignment: { vertical: 'middle', horizontal: 'center' }
        }
    }));

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.freezePanes = 'A2';

    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F1F1F' } };
        });

        if (rowNumber === 1) {
            row.height = 24;
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF0D6EFD' }
                };
                cell.font = {
                    name: 'Calibri',
                    size: 10,
                    bold: true,
                    color: { argb: 'FFFFFFFF' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            return;
        }

        if (rowNumber % 2 === 0) {
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFEAF3FF' }
                };
            });
        } else {
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFFFFF' }
                };
            });
        }
    });
}

function ceorExportToExcel() {
    if (CEOR_APP.filteredResults.length === 0) {
        alert('Tidak ada data yang dapat diexport.');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mobilkom';
    workbook.created = new Date();

    const summaryHeaders = ['Location Name', 'RTU Tipe', 'Periode/Bulan', '#Date', 'Availability Accept', '#Press', '#Flow'];
    const summaryRows = CEOR_APP.filteredSummaryResults.map(item => [
        item.nodeId,
        formatWellpadName(item.rtuType || 'Wellpad UNKNOWN'),
        item.periode,
        item.totalHari,
        item.availabilityAccept,
        item.acceptPress,
        item.acceptFlow
    ]);

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(summaryHeaders);
    summaryRows.forEach(row => summarySheet.addRow(row));
    ceorApplyCeorSheetStyle(summarySheet, [18, 16, 18, 14, 18, 16, 16]);

    const detailHeaders = ['Node Id', 'tgl', 'total data', 'good data', 'avgpressure', 'avg flow', 'availbilty', 'availability Accept', 'press 1', 'flow 1'];
    const detailRows = CEOR_APP.filteredResults.map(row => [
        row.nodeId,
        row.tgl,
        row.totalData,
        row.goodData,
        (row.avgPressure !== null) ? Number(row.avgPressure.toFixed(2)) : 'NULL',
        (row.avgFlow !== null) ? Number(row.avgFlow.toFixed(2)) : 'NULL',
        Number((row.availability).toFixed(2)),
        row.availabilityAccept,
        row.press1,
        row.flow1
    ]);

    const detailSheet = workbook.addWorksheet('Detail Data');
    detailSheet.addRow(detailHeaders);
    detailRows.forEach(row => detailSheet.addRow(row));
    ceorApplyCeorSheetStyle(detailSheet, [15, 12, 12, 12, 15, 15, 14, 18, 10, 10]);

    const wellpadGroups = buildWellpadGroups(CEOR_APP.filteredResults);
    const wellpadSheet = workbook.addWorksheet('Wellpad Summary');

    let wellpadRowNum = 0;
    wellpadGroups.forEach((group, idx) => {
        // Header ringkas: "Wellpad N (contoh-node)"
        const sampleNode = group.nodeIds[0] || '';
        const headerLabel = `${group.wellpad} (${sampleNode})`;
        const header = [
            headerLabel,
            'Pressure Switch',
            'Pressure Transmitter',
            'Coriolis Flowmeter',
            'Magnetic Flowmeter'
        ];
        wellpadSheet.addRow(header);
        wellpadRowNum++;

        group.nodeIds.forEach((nodeId) => {
            const nodeRows = CEOR_APP.filteredResults.filter((r) => normalizeNodeId(r.nodeId) === nodeId);
            const pressureSwitch = nodeRows.some((r) => r.press1 === 1) ? 1 : 0;
            const pressureTransmitter = nodeRows.some((r) => r.press1 === 1) ? 1 : 0;
            const coriolisFlowmeter = nodeRows.some((r) => r.flow1 === 1) ? 1 : 0;
            const magneticFlowmeter = nodeRows.some((r) => r.flow1 === 1) ? 1 : 0;
            wellpadSheet.addRow([nodeId, pressureSwitch, pressureTransmitter, coriolisFlowmeter, magneticFlowmeter]);
            wellpadRowNum++;
        });

        if (idx < wellpadGroups.length - 1) {
            wellpadSheet.addRow([]);
            wellpadRowNum++;
        }
    });

    // Track which rows are group headers for styling
    const wellpadHeaderRows = new Set();
    let trackRow = 0;
    wellpadGroups.forEach((group, idx) => {
        trackRow++; // header row
        wellpadHeaderRows.add(trackRow);
        trackRow += group.nodeIds.length; // data rows
        if (idx < wellpadGroups.length - 1) trackRow++; // empty row
    });

    wellpadSheet.columns = [
        { key: '0', width: 22 },
        { key: '1', width: 18 },
        { key: '2', width: 22 },
        { key: '3', width: 20 },
        { key: '4', width: 20 }
    ];

    wellpadSheet.eachRow((row, rowNumber) => {
        const isHeader = wellpadHeaderRows.has(rowNumber);
        if (isHeader) {
            row.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B659D' } };
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                    right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            return;
        }

        row.eachCell((cell) => {
            const rowFill = rowNumber % 2 === 0 ? 'FFD9E1F2' : 'FFFFFFFF';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
            cell.font = { name: 'Calibri', size: 10, bold: false, color: { argb: 'FF1F1F1F' } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
    });

    // === Sheet 4: Node Group Summary (Monthly Report per Node ID) ===
    // Kolom: Location Name, RTU Tipe, #Date, #Press, #Flow
    const nodeMonthlyMap = new Map();
    CEOR_APP.filteredResults.forEach((row) => {
        const nodeId = normalizeNodeId(row.nodeId);
        if (!nodeId) return;

        if (!nodeMonthlyMap.has(nodeId)) {
            nodeMonthlyMap.set(nodeId, {
                nodeId,
                rtuType: detectWellpad(nodeId),
                totalDays: 0,
                acceptPress: 0,
                acceptFlow: 0
            });
        }
        const item = nodeMonthlyMap.get(nodeId);
        item.totalDays++;
        if (row.press1 === 1) item.acceptPress++;
        if (row.flow1 === 1) item.acceptFlow++;
    });

    const groupSheet = workbook.addWorksheet('Node Group Summary');
    groupSheet.addRow(['Location Name', 'RTU Tipe', '#Date', '#Press', '#Flow']);
    [...nodeMonthlyMap.values()]
        .sort((a, b) => a.nodeId.localeCompare(b.nodeId))
        .forEach(item => {
            groupSheet.addRow([
                item.nodeId,
                formatWellpadName(item.rtuType),
                item.totalDays,
                item.acceptPress,
                item.acceptFlow
            ]);
        });
    ceorApplyCeorSheetStyle(groupSheet, [20, 20, 12, 12, 12]);

    const timestamp = new Date().toISOString().slice(0, 10);
    workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CEOR_Report_${timestamp}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        ceorShowNotification('Laporan Excel berhasil diunduh dengan Summary, Detail, Wellpad, dan Group Sheet.', 'success');
    }).catch((error) => {
        console.error('Error exporting CEOR Excel:', error);
        ceorShowNotification('Gagal mengekspor laporan Excel. Silakan coba lagi.', 'error');
    });
}

/**
 * Export Hasil Tabel CEOR ke Format PDF
 */
function ceorExportToPDF() {
    if (CEOR_APP.filteredResults.length === 0) {
        alert('Tidak ada data yang dapat diexport.');
        return;
    }

    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        alert('Library jsPDF tidak ditemukan.');
        return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CEOR DATA SUMMARY REPORT', 14, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 22);
    doc.text(`Total Baris Data: ${CEOR_APP.filteredResults.length}`, 14, 27);

    const summaryHeaders = [['Location Name', 'RTU Tipe', 'Periode/Bulan', '#Date', 'Availability Accept', '#Press', '#Flow']];
    const summaryRows = CEOR_APP.filteredSummaryResults.map(row => [
        row.nodeId,
        row.rtuType || 'Wellpad UNKNOWN',
        row.periode,
        row.totalHari,
        row.availabilityAccept,
        row.acceptPress,
        row.acceptFlow
    ]);

    doc.autoTable({
        head: summaryHeaders,
        body: summaryRows,
        startY: 32,
        theme: 'grid',
        headStyles: {
            fillColor: [13, 110, 253],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { fontStyle: 'bold' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'center' }
        },
        styles: {
            fontSize: 8,
            cellPadding: 3
        }
    });

    const detailHeaders = [['Node Id', 'tgl', 'total data', 'good data', 'avgpressure', 'avg flow', 'availbilty', 'availability Accept', 'press 1', 'flow 1']];
    const detailRows = CEOR_APP.filteredResults.map(row => [
        row.nodeId,
        row.tgl,
        row.totalData,
        row.goodData,
        row.avgPressure !== null ? row.avgPressure.toFixed(2) : 'NULL',
        row.avgFlow !== null ? row.avgFlow.toFixed(2) : 'NULL',
        row.availability.toFixed(2) + '%',
        row.availabilityAccept,
        row.press1,
        row.flow1
    ]);

    doc.autoTable({
        head: detailHeaders,
        body: detailRows,
        startY: doc.lastAutoTable.finalY + 8,
        theme: 'grid',
        headStyles: {
            fillColor: [13, 110, 253],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { fontStyle: 'bold' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'center' },
            7: { halign: 'center' },
            8: { halign: 'center' },
            9: { halign: 'center' }
        },
        styles: {
            fontSize: 8,
            cellPadding: 3
        }
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    doc.save(`CEOR_Summary_Report_${timestamp}.pdf`);
    ceorShowNotification('Laporan PDF berhasil diunduh.', 'success');
}


// ==========================================
// 8. UTILITY & HELPER FUNCTIONS
// ==========================================

/**
 * Mencegah XSS Injection pada HTML Rendering
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Menampilkan Loading Indicator
 */
function ceorShowLoading(isLoading, message = 'Memproses data...') {
    let loader = document.getElementById('ceorLoadingOverlay');
    if (isLoading) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'ceorLoadingOverlay';
            loader.className = 'position-fixed top-0 start-0 w-100 h-100 flex-column justify-content-center align-items-center bg-dark bg-opacity-50 text-white';
            loader.style.zIndex = '9999';
            loader.innerHTML = `
                <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <h5 id="ceorLoadingMsg" class="fw-semibold">${escapeHtml(message)}</h5>
            `;
            document.body.appendChild(loader);
        } else {
            const msgEl = document.getElementById('ceorLoadingMsg');
            if (msgEl) msgEl.textContent = message;
        }
        loader.classList.remove('d-none');
        loader.classList.add('d-flex');
    } else if (loader) {
        loader.classList.remove('d-flex');
        loader.classList.add('d-none');
    }
}

/**
 * Menampilkan Toast Notification
 */
function ceorShowNotification(message, type = 'info') {
    let toastContainer = document.getElementById('ceorToastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'ceorToastContainer';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3 z-3';
        document.body.appendChild(toastContainer);
    }

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type} border-0 show`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${escapeHtml(message)}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toastEl);

    setTimeout(() => {
        toastEl.remove();
    }, 4000);
}

})();
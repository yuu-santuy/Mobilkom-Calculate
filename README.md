# NUFLO & Pressure Data Dashboard — PT Mobilkom Telekomindo

Aplikasi web (HTML/CSS/JS murni, tanpa server/backend) untuk menghitung **availability** dan **tagihan** dari data NUFLO (sumur) dan Pressure Data (titik tekanan), lengkap dengan verifikasi manual dan perbandingan antar sumber data.

Dibuka langsung lewat browser (`index.html`) — tidak perlu install apa pun.

---

## Struktur File

```
nuflo/
├── index.html      → seluruh struktur halaman (NUFLO + Pressure Data)
├── style.css        → seluruh styling
├── script.js         → logic untuk modul NUFLO (upload, hitung, tagihan, export)
├── pressure.js       → logic untuk modul Pressure Data (upload, hitung, perbandingan, export)
└── README.md         → dokumen ini
```

Modul NUFLO (`script.js`) dan modul Pressure Data (`pressure.js`) **saling independen** — tidak berbagi variabel/state. Perubahan di satu modul tidak akan memengaruhi modul lainnya.

---

## Cara Menjalankan

1. Extract folder ini.
2. Buka `index.html` langsung di browser (double click).
3. Pilih menu lewat ikon ☰ di pojok kiri atas: **Hitung NUFLO** atau **Hitung Pressure Data**.

> ⚠️ **Penting sebelum export final**: data yang sudah diupload tersimpan di memori browser selama halaman belum di-refresh (lihat bagian "Simpan Permanen?" di bawah). Kalau kamu habis testing beberapa file berbeda di kotak upload yang sama, **refresh halaman dulu (F5) dan upload ulang dari nol pakai mode "Upload Baru"** sebelum export final — supaya nggak ada data lama dari testing sebelumnya yang ikut nyangkut ke hasil export. Kalau ragu, cek dulu "Start Date"/"End Date" di hasil export-nya sudah sesuai isi file asli atau belum.

Untuk dipakai bersama (bukan cuma di komputer sendiri), upload folder ini ke GitHub lalu aktifkan **GitHub Pages** — sudah pernah dibahas caranya di percakapan sebelumnya.

---

## Modul 1 — NUFLO

### Format data yang didukung
`.xls`, `.xlsx`, `.csv` — Mendukung format lama maupun format baru (A-Q) dengan deteksi kolom fleksibel:
- **Identitas**: `WELLNAME` / `NodeID`, `UWI`, `RTU_ID`.
- **Waktu**: `LASTGOOD_SCANDATE` / `Date`, `LASTGOOD_SCANTIME` / `ScanTime`.
- **Availability**: `COMM_PERCENT` (jika data summary) atau jumlah baris (jika data mentah per menit).
- **Sensor**: `FLOW_RATE`, `INTERNAL_TEMP_C`, `SUPPLY_VOLTAGE`, `BATTERY_VOLTAGE`.
- **Tambahan**: `CONTROLLER_TYPE`, `HOURLY_RUNTIME`, `DAILY_FLOW_RATE`, `GRAND_TOTAL_RATE`.
- NodeID berbentuk scientific notation pada CSV (mis. `7.00E-36`) dikonversi ke bentuk ringkas (`7E-36`) dan dicatat di panel diagnostik. Karena CSV tidak dapat memastikan apakah teks awalnya memang identifier seperti itu, cocokkan hasil konversi dengan sumber data asli.

### Rumus Availability
```
Availability (%) = (Jumlah baris data per Sumur per Tanggal ÷ 1440) × 100
```
1440 = jumlah menit dalam 24 jam. Idealnya alat NUFLO melapor tiap 1 menit sekali.

### Status Billing
```
Availability ≥ 90%  → Status 1 (Bisa Ditagih)
Availability < 90%  → Status 0 (Belum Bisa Ditagih)
```

### Fitur
- Upload Baru / Tambahkan Data (gabung otomatis, anti duplikat: tanggal yang sudah ada & datanya identik akan dilewati, kalau datanya beda akan diperbarui).
- Filter: cari nama sumur/tanggal, filter per sumur, filter status.
- Grafik trend availability (per sumur) atau perbandingan antar sumur.
- Harga per hari: bisa diatur default untuk semua sumur, atau harga khusus per sumur (override).
- Verifikasi manual: tombol "Cek Manual" menampilkan rumus step-by-step dan contoh baris mentah, untuk dicocokkan manual ke Excel.

### Export Excel
**Sheet "Billable WIW Online Monitoring"** (ringkasan per sumur):
- Header: No, Location Name, RTU Tipe, RTU ID, #Data, SER-02 (IDR), SER-04 (IDR), SER-18 (IDR), Total (IDR), Grand Total (IDR)
- Baris: Per sumur yang punya ≥1 hari Accept (Status=1)
- Ringkasan: Breakdown per service code (SER-02, SER-04, SER-18) + grand total

**Sheet "Detail Harian"** (data harian per sumur):
- Header: WELLNAME, RTU_ID, DATE, #DATA, AVAILABILITY (%), #DATA PAY, AVG FLOW_RATE, AVG INTERNAL_TEMP_C, AVG SUPPLY_VOLTAGE, AVG BATTERY_VOLTAGE
- Baris: SEMUA data per sumur per tanggal (tidak hanya yang Accept), sorted by wellname + date
- Warna: Hijau (Accept/Status=1), Merah (Reject/Status=0)
- Kontrak info: Request Order, Periode, Start Date, End Date (di bagian atas)

### Export PDF
- Halaman 1: Detail ringkasan (sama dengan Sheet Billable)
- Halaman 2+: Tabel detail harian (format landscape, header & footer, sorting sama)

---

## Modul 2 — Pressure Data

### Format data yang didukung
`.csv`, `.xls`, `.xlsx` — kolom yang dicari:
- Kolom waktu: dicari otomatis di antara kolom bernama `timestamp`, `datetime`, atau `date` — **dipilih berdasarkan ISI datanya** (harus terbaca sebagai tanggal/serial Excel yang wajar), bukan cuma nama kolom. Ini penting karena di beberapa file, kolom bernama "datetime" ternyata isinya angka epoch (bukan tanggal), sementara kolom "timestamp" yang isinya tanggal beneran.
- Kolom `frame` selalu diabaikan (bukan data tekanan).
- Kolom titik tekanan: **semua kolom lain**, TAPI kolom yang isinya **selalu 0 di seluruh baris data** otomatis dianggap "belum dipakai / placeholder" dan **dikeluarkan dari perhitungan** (contoh: `Pressure6`, `Pressure7`, `Pressure8` di data Mobilkom). Ini terdeteksi otomatis, tidak di-hardcode nama kolomnya, supaya tetap jalan walau nama kolom berbeda di file lain.

### Deteksi Granularitas Otomatis (basis 1440 vs 2880 vs lainnya)
Sistem otomatis mendeteksi seberapa sering sebuah sumber mencatat data:
- Kalau maksimal 1 baris per menit (seperti Mobilkom) → basis harian = **1440** (24 jam × 60 menit).
- Kalau ada 2 baris per menit (seperti PHR, tiap 30 detik) → basis harian = **2880**.
- Terdeteksi otomatis dari isi data itu sendiri (cek betulan apakah ada 2+ baris berbeda yang jatuh di menit yang sama, bukan cuma sebaran detik) — bukan hardcode nama sumber, supaya tetap benar walau nanti ada sumber ketiga dengan interval yang beda lagi.

Setiap "slot" waktu (menit kalau basisnya 1440, setengah-menit kalau basisnya 2880) dihitung **sendiri-sendiri** sebagai Connected atau tidak — tidak lagi dipadatkan/digabung. Kalau dalam 1 menit ada 2 slot (`:00` dan `:30`) dan salah satunya Connected sementara yang lain Not Connect, KEDUANYA tetap dihitung apa adanya sebagai 2 slot terpisah (1 Connected + 1 Not Connect) — bukan digabung jadi 1 keputusan per menit.

### Model 3-Status: Connected / Not Connect / Tidak Tercatat
Ditemukan bahwa beberapa file (terutama data mitra/PHR) punya sel berisi **teks** seperti `"Not Connect"`, bukan cuma angka atau kosong. Sistem membedakan 3 kondisi untuk setiap slot waktu, di setiap titik:

| Status | Artinya | Dihitung sebagai availability? |
|---|---|---|
| **Connected** | Ada baris di file, isinya angka valid | ✅ Ya, masuk pembilang |
| **Not Connect** | Ada baris di file, tapi isinya teks non-angka (mis. "Not Connect") | ❌ Tidak (tapi tetap "memakan" porsi dari basis harian) |
| **Tidak Tercatat** | Tidak ada baris sama sekali di file untuk slot itu | ❌ Tidak (tetap "memakan" porsi dari basis harian) |

Analoginya seperti kehadiran karyawan: **izin** dan **tidak masuk sama sekali** itu 2 hal berbeda alasannya, tapi keduanya SAMA-SAMA mengurangi persentase kehadiran — bukan diabaikan begitu saja dari perhitungan total hari kerja. Ketiga status ini ditampilkan terpisah di:
- **Sparkline** di tabel (3 warna: hijau=connected, oranye=not connect, abu=tidak tercatat).
- **Lihat Detail** — timeline 3 warna per slot (kalau basisnya 2880, tiap menit tampil sebagai 2 kotak kecil berdampingan).
- **Cek Perhitungan** — rincian lengkap: jumlah per status (total harus selalu sama dengan basis harian yang terdeteksi), daftar SELURUH slot Connected dan SELURUH slot Not Connect (bukan cuma contoh).

### Rumus Availability
```
Availability (%) = (Jumlah slot Connected per Titik per Tanggal ÷ Basis Harian) × 100
Status: Availability ≥ 90% → 1 (Bisa Ditagih), < 90% → 0 (Belum Bisa Ditagih)
```
Basis Harian otomatis 1440 atau 2880 (atau lainnya) sesuai granularitas yang terdeteksi untuk sumber itu. Karena hasil akhirnya SAMA-SAMA berupa persentase (0–100%), sumber dengan basis berbeda (mis. Mobilkom basis 1440 vs PHR basis 2880) tetap bisa dibandingkan apple-to-apple di fitur Perbandingan — persentase secara matematis sudah menormalkan perbedaan basis itu.

### Upload 2 Sumber
- **Data Mobilkom** — boleh upload banyak file sekaligus (1 file per hari), otomatis digabung jadi 1 dataset.
- **Data Mitra** — nama PT-nya diketik bebas di kotak input (tidak di-hardcode "PHR"), karena partner datanya bisa beda-beda tergantung proyek.
- Sebelum file diproses, muncul kotak kuning kalau sumber itu **sudah punya data** — nunjukin berapa titik/tanggal yang sudah ada, biar kamu sadar apakah perlu pakai mode "Upload Baru" (ganti total) atau "Tambahkan" (gabung).

Masing-masing sumber punya toggle **Upload Baru** / **Tambahkan** (mode gabung dengan logika anti-duplikat yang sama seperti NUFLO).

### Kelola Data (Hapus Sebagian)
Setiap baris di tabel detail punya **checkbox** — centang satu atau beberapa baris (bisa dikombinasikan dengan filter search/tag/status/sumber buat mempersempit dulu), lalu klik **"🗑 Hapus yang Dipilih"** di atas tabel buat menghapus HANYA baris yang dicentang, tanpa perlu reset semua data. Ada juga checkbox "pilih semua" di header tabel.

### Tabel Detail
Menampilkan semua titik dari kedua sumber dalam 1 tabel (ada kolom "Sumber" untuk membedakan), dengan:
- **Kolom "Rincian Menit (C / NC / TT)"** — breakdown langsung di tabel: Connected / Not Connect / Tidak Tercatat, tanpa perlu buka modal detail.
- **Sparkline** — preview visual kecil (24 kotak = 24 jam) menunjukkan kepadatan data per jam, pengganti teks "rentang jam" yang membingungkan.
- **Lihat Detail** — modal timeline lengkap 24 jam × 60 menit, dengan penanda menit (0,10,...,50), info bar besar yang menunjukkan jam & nilai persis saat kursor diarahkan ke suatu kotak, plus daftar teks rentang waktu yang bolong.
- **Cek Perhitungan** — modal verifikasi manual (formula step-by-step + contoh baris mentah), sama seperti fitur "Cek Manual" di NUFLO.

### Perbandingan Otomatis (Mobilkom vs Mitra)
Begitu **kedua sumber** sama-sama sudah ada datanya, sistem otomatis (tanpa perlu tombol/aksi manual) menghitung dan menampilkan:
- Ringkasan: jumlah titik+tanggal yang match, rata-rata selisih availability, jumlah yang "Cocok" vs "Perlu Ditinjau".
- **Status Verifikasi** per baris: ✅ Cocok kalau status billing (1/0) kedua sumber SAMA, ⚠️ Perlu Ditinjau kalau BEDA (ini yang berguna untuk mendeteksi potensi selisih klaim antara data internal dan data mitra).
- Penjelasan teks otomatis (berapa persen yang cocok, di mana selisih terbesar ditemukan).
- **Diagram hasil perbandingan**: donut chart (proporsi Cocok vs Perlu Ditinjau) dan bar chart (rata-rata selisih availability per titik, merah kalau selisihnya besar).
- Export Excel/PDF khusus untuk hasil perbandingan.

### Export Excel
- **Export Excel** — ada dropdown pilihan: Semua Sumber / Mobilkom saja / Mitra saja. Formatnya kesamping (pivot), 1 baris per tanggal, dengan header PERSIS seperti laporan referensi: `Name`, `DateStamp`, `RTU`, `PT1`...`PTn` (availability %), `RTU_Pay`, `PT1_Pay`...`PTn_Pay` (1/0), plus baris ringkasan `RTU#`, `PT1#`...`PTn#` (jumlah hari Pay=1) di bagian bawah, dan legenda nama titik asli. **Kalau pilih "Semua Sumber", tetap dibuat sheet TERPISAH per sumber (tidak digabung jadi 1 sheet).**
- **Export PDF** — versi cetak dari tabel detail maupun tabel perbandingan.

---

## Kolom "RTU" — Sudah Terpecahkan ✅

Sempat jadi pertanyaan terbuka, tapi sekarang sudah dipastikan lewat penjelasan senior + verifikasi manual terhadap laporan referensi "Petani GS":

> **RTU = nilai availability TERTINGGI di antara semua titik (PT1...PTn) pada tanggal itu.**

Rasionalnya: RTU adalah alat komunikasi/pengukur induk yang terhubung ke titik-titik tekanan di pipa — dianggap "hidup" pada suatu menit kalau MINIMAL 1 titik yang tersambung ke dia berhasil melapor. Hipotesis ini dicek manual ke SELURUH baris di laporan referensi dan **cocok 100%** — sudah diimplementasikan di export Excel (kolom `RTU` dan `RTU_Pay`, plus ringkasan `RTU#`).

---

## Riwayat Bug yang Pernah Ditemukan & Diperbaiki

Dicatat di sini supaya kalau muncul lagi (misal karena format file baru), sudah ada jejak penyebabnya:

1. **Kolom "datetime" berisi epoch, bukan tanggal** — di beberapa file Mobilkom, kolom bernama `datetime` isinya angka epoch milidetik, sementara kolom `timestamp` yang isinya tanggal terbaca manusia. Sistem sekarang memilih kolom waktu berdasarkan ISI datanya (apakah terlihat seperti tanggal/serial Excel yang wajar), bukan cuma nama kolom.
2. **Kolom `InternalTemperature(°C)` di NUFLO** — nama kolom asli punya embel-embel satuan, kode lama mencari nama persis `InternalTemperature` sehingga selalu dianggap kosong (rata-rata jadi 0). Sekarang pakai pencocokan `startsWith`.
3. **Format persen di Excel jadi salah kali 100** — availability 40.4166...% jadi tampil `4042%` kalau pakai format Percentage bawaan Excel (yang mengasumsikan nilai dalam bentuk pecahan 0-1). Sekarang pakai custom number format `0.00"%"` yang menempelkan simbol % sebagai teks, bukan format Percentage asli.
4. **Timezone shift pada parsing tanggal** — semua tanggal/jam diproses dengan getter UTC (`getUTCFullYear`, dst) secara konsisten, supaya tidak bergeser 1 hari tergantung timezone browser yang dipakai.
5. **Kolom "Selisih" di export perbandingan tampil kosong** — sebelumnya nilai Selisih ditulis sebagai rumus Excel (`=C4-D4`) tanpa nilai hasil hitungannya dicantumkan lebih dulu. Kalau file dibuka di program yang tidak otomatis menjalankan ulang rumus (bukan Excel/LibreOffice asli), kolom itu tampil kosong. Sekarang nilai Selisih dihitung dulu di sistem, baru ditulis sebagai angka pasti ke Excel — jadi langsung kebaca di program apa pun.
6. **Teks "Not Connect" di dalam data pressure** — ditemukan ada file (terutama data mitra) yang selnya berisi teks `"Not Connect"`, bukan cuma angka atau kosong. Sistem sudah menangani ini dengan benar sejak awal (`parseFloat` gagal → dianggap tidak ada data), tapi sekarang statusnya dibedakan eksplisit dari "tidak tercatat sama sekali" (lihat bagian "Model 3-Status" di atas) supaya bisa diverifikasi manual dengan jelas.
7. **Data dari sesi test sebelumnya ikut nyangkut** — karena data tersimpan di memori browser selama halaman belum di-refresh, beberapa kali ditemukan hasil export mencampur data dari file yang berbeda dari yang baru diupload. Ini bukan bug perhitungan, tapi risiko workflow. Sekarang ada tombol **"🗑 Reset Semua Data Pressure"** untuk mengosongkan state dengan sengaja sebelum mulai sesi baru — pakai ini setiap kali mau memastikan hasil export benar-benar segar.
8. **Rumus dasar availability untuk sumber ber-granularitas halus (PHR, 2×/menit)** — awalnya semua sumber dipadatkan ke basis 1440 (ambil 1 baris per menit). Setelah dikonfirmasi ulang, ternyata perhitungan yang benar adalah: hitung dulu availability memakai basis harian ASLI sumber itu (2880 untuk yang 2×/menit), baru hasil PERSENTASE-nya dibandingkan ke sumber lain — bukan memadatkan datanya duluan. Dibuktikan matematis bahwa "konversi 2880 ke 1440 dulu baru dibandingkan" hasilnya identik dengan "langsung bagi 2880", jadi caranya disederhanakan langsung ke pembagian native. Diverifikasi memakai data pivot table manual dari kakak senior sampai hasilnya persis sama (90.00%).
9. **Rounding floating-point pada tanggal Excel** — serial tanggal Excel disimpan sebagai pecahan hari, dan konversi ke jam:menit:detik kadang meleset beberapa milidetik (mis. niatnya `00:02:00.000` malah kebaca `00:01:59.997`). Ini menyebabkan sistem salah mengelompokkan sebagian slot waktu ke menit sebelumnya, sehingga sebagian data yang sebenarnya valid ikut "hilang" secara diam-diam saat deteksi granularitas 30-detik. Sekarang setiap tanggal/jam dibulatkan ke detik terdekat dulu sebelum diproses lebih lanjut.

---

## Modul 3 — OPM Verification

Modul OPM Verification memproses file export hasil verifikasi OPM (Operational Performance Monitoring) untuk monitoring status penerimaan data per parameter sensor di setiap RTU/fasilitas.

### Format Data
File `.csv` / `.xlsx` dengan struktur:
- **Identitas**: `RTU_ID`, `REPORT_DATE`, `FACILITY_NAME`, `OPS_TEAM`, `NODE_TYPE`
- **Status Utama**: `AVAILABILITY`, `RELIABILITY` (≥90% = Accept), `STATUS_COMPLIANCE` (Accepted/Rejected)
- **Parameter Verifikasi** (dinamis): `TEMP_1_NDC_VERIFICATION`, `TEMP_2_NDC_VERIFICATION`, `TEMP_3_NDC_VERIFICATION`, `TEMP_4_VERIFICATION`, `WATER_LEVEL_VERIFICATION`, `PRESSURE_VERIFICATION`, dll
- **Nilai Sensor Terkait**: `AVG_TEMP_1_NDC`, `AVG_TEMP_2_NDC`, `AVG_TEMP_3_NDC`, `AVG_TEMP_4`, `AVG_WATER_LEVEL`, `AVG_PRESSURE`

### Aturan Accept/Reject (Independent per Parameter)
- **STATUS_COMPLIANCE**: Dari kolom `STATUS_COMPLIANCE` atau auto-deteksi dari `RELIABILITY` (≥90% → Accept, <90% → Reject)
- **Setiap Parameter *_VERIFICATION**: 
  - Accept jika nilai di kolom `AVG_*` terkait BUKAN kosong (ada angka)
  - Reject jika kosong (tidak ada data)
- Perhitungan masing-masing parameter **INDEPENDEN** — tidak dipengaruhi status parameter lain

### Ringkasan Harian (Per RTU + Facility + OPS Team + Node Type + Tanggal)
Tabel detail menampilkan untuk setiap kombinasi:
- **Total Record**: Jumlah baris data di hari itu
- **Status Accept/Reject**: Jumlah baris dengan `STATUS_COMPLIANCE` = Accepted / Rejected
- **Accept Rate (%)**: (Status Accept / Total Record) × 100
- **Breakdown per Parameter** (dinamis):
  - TEMP_1_NDC: Jumlah baris Accept
  - TEMP_2_NDC: Jumlah baris Accept
  - TEMP_3_NDC: Jumlah baris Accept
  - TEMP_4: Jumlah baris Accept
  - WATER_LEVEL: Jumlah baris Accept
  - PRESSURE: Jumlah baris Accept
  - (dst sesuai kolom *_VERIFICATION yang terdeteksi)

### Ringkasan Bulanan (Per RTU + Facility + OPS Team + Node Type + Bulan)
Agregat dari seluruh hari di bulan itu:
- **Total Hari**: Jumlah hari unik bulan itu
- **Status Accept/Reject**: Total jumlah Accept/Reject dari SEMUA baris di bulan itu
- **Accept Rate (%)**: (Total Accept / Total rows) × 100
- **Breakdown per Parameter (Independent)**:
  - TEMP_1_NDC: Sum total baris Accept di seluruh bulan
  - TEMP_2_NDC: Sum total baris Accept di seluruh bulan
  - (dst)

**Penting**: Breakdown parameter dihitung langsung dari jumlah baris, bukan dari "berapa hari yang Accept". Setiap hari bisa punya record berbeda per parameter.

### Kolom Dinamis
Semua kolom parameter verifikasi (`*_VERIFICATION`) **dideteksi otomatis** dari isi file — header tabel di web maupun Excel export menyesuaikan secara dinamis sesuai parameter yang ada, tidak hardcoded.

### Export Excel & PDF
- **Sheet "Detail OPM"**: Seluruh baris data mentah dengan warna (hijau=Accept, merah=Reject)
- **Sheet "Ringkasan Harian"**: Per tanggal + RTU + Fasilitas, breakdown per parameter
- **Sheet "Ringkasan Bulanan"**: Per bulan + RTU + Fasilitas, aggregate breakdown per parameter
- **Sheet "Data Gabungan"**: Semua header asli dari file input, untuk referensi
- **PDF**: Halaman pertama detail baris, halaman kedua ringkasan harian, halaman ketiga ringkasan bulanan
- Kolom parameter pada ringkasan PDF mengikuti seluruh kolom `*_VERIFICATION` yang terdeteksi, bukan daftar parameter tetap.

## Normalisasi NodeID CEOR

Modul CEOR menghapus suffix `EXT` dari NodeID untuk pengelompokan. Setelah pemrosesan, dashboard menampilkan notifikasi pasangan nilai asli dan hasil normalisasi agar perubahan identifier terlihat dan dapat diperiksa.

---

## Modul 1 — NUFLO (Updated)

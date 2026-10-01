# PROJECT.md — Riwayat Lengkap Proyek NUFLO & Pressure Data Dashboard

Dokumen ini mencatat seluruh perjalanan proyek magang di **PT Mobilkom Telekomindo**, dari awal tidak tahu harus mulai dari mana, sampai jadi aplikasi web 2 modul (NUFLO + Pressure Data) yang lengkap dengan verifikasi manual dan perbandingan antar sumber data.

---

## 1. Latar Belakang

Seorang mahasiswa magang di PT Mobilkom (bidang Teknologi Informasi) diminta oleh senior di tempat magang untuk membuat **web internal** yang bisa menghitung **availability** sumur/titik dari data mentah Excel — karena senior tersebut kesulitan menghitung manual satu-per-satu untuk ratusan/ribuan baris data.

Instruksi awal dari senior (disampaikan lewat mahasiswa magang, bukan langsung ke Claude):
- Availability dihitung dari data NUFLO (alat monitoring sumur).
- Kalau availability ≥ 90%, sumur itu **bisa ditagih** (status 1). Kalau < 90%, **belum bisa ditagih** (status 0).
- Ada contoh tampilan sebelumnya dari anak magang lain: bisa upload dataset besar, sistem otomatis hitung, ada highlight warna (merah <90%, hijau ≥90%).
- Tidak ada rumus resmi yang dikasih di awal ("perhitungannya biasa aja, nggak ada rumus") — rumus pastinya baru ketemu belakangan lewat serangkaian pertanyaan balik dan contoh data.

---

## 2. Modul 1 — NUFLO

### 2.1 Memahami Data
File NUFLO berisi log sensor per-menit dari alat NUFLO MCIII yang dipasang di sumur minyak/gas, dengan kolom:
`Date`, `ScanTime`, `NodeID` (nama sumur), `GrandTotal`, `Flowrate`, `DailyTotal`, `DailyRunTime`, `HourlyTotal`, `HourlyRunTime`, `InternalTemperature`, `SupplyVoltage`, `BatteryVoltage`.

### 2.2 Rumus yang Disepakati
Setelah beberapa kali klarifikasi dengan senior:
```
Availability (%) = (Jumlah baris data per Sumur per Tanggal ÷ 1440) × 100
Status: Availability ≥ 90% → 1 (Bisa Ditagih)
        Availability < 90% → 0 (Belum Bisa Ditagih)
Average kolom lain (Flowrate, Temp, dst) = rata-rata sederhana (SUM ÷ COUNT), apa adanya
```
1440 = jumlah menit dalam 24 jam, karena idealnya alat NUFLO melapor tiap 1 menit sekali.

### 2.3 Fitur yang Dibangun (bertahap, v1 s.d. v4)
- Upload & proses file `.xls`/`.xlsx`/`.csv`, mendukung banyak sheet (auto-gabung sheet yang punya kolom NodeID+Date).
- Panel diagnostik file (sheet mana yang dipakai, kolom apa yang terdeteksi).
- Filter: cari nama sumur/tanggal, filter per sumur, filter status (hijau/merah).
- Grafik trend availability (Chart.js).
- Panel harga: harga default per hari + harga khusus per sumur (override manual).
- Ringkasan tagihan per sumur (total hari bisa ditagih × harga).
- Export Excel (ExcelJS: berwarna, ada rumus SUM/AVERAGE asli) dan PDF (jsPDF + autotable).
- Verifikasi manual ("Cek Manual"): rumus step-by-step + contoh baris mentah untuk dicocokkan manual ke Excel.
- Fitur "Tambahkan Data" — gabung file baru ke data yang sudah ada, dengan logika: tanggal baru → ditambahkan, tanggal sama & data identik → dilewati (skip), tanggal sama tapi data beda → diperbarui (update). Ada laporan modal setelah proses (berapa ditambah/diperbarui/dilewati) dan panel riwayat upload.

### 2.4 Bug yang Ditemukan & Diperbaiki
1. **Sheet yang salah terbaca** — kode awal (dibuat AI lain sebelumnya) selalu ambil sheet pertama, padahal file NUFLO punya 2 sheet: `Sheet1` (ringkasan tanpa kolom NodeID/Date) dan `Sheet2` (data mentah yang benar). Diperbaiki: sistem cari sheet berdasarkan keberadaan kolom NodeID+Date, dan gabungkan SEMUA sheet yang cocok (bukan cuma yang pertama ketemu) — supaya tetap jalan walau data ada di 3+ sheet.
2. **Kolom `InternalTemperature(°C)`** — nama kolom asli punya embel-embel satuan derajat celcius, kode lama mencari nama persis `InternalTemperature` sehingga rata-rata selalu 0. Diperbaiki dengan pencocokan `startsWith` (bukan exact match).
3. **Format persen di Excel jadi salah kali 100** — availability `40.4166...%` kalau diberi format "Percentage" bawaan Excel jadi tampil `4042%` (karena Excel mengasumsikan nilainya pecahan 0–1). Diperbaiki dengan custom number format `0.00"%"` yang menempelkan simbol % sebagai teks, bukan format Percentage asli.
4. Ditemukan juga bahwa file `.xls` (format lama) mentok di 65.536 baris per sheet — kalau data terus bertambah, disarankan pindah ke `.xlsx` (kapasitas ~1 juta baris).

### 2.5 Batasan yang Belum Terselesaikan
Fitur perhitungan invoice detail (harga per sumur berdasarkan kombinasi kode layanan SER-01/05/07 seperti contoh invoice Pertamina yang pernah ditunjukkan) tidak jadi dikembangkan lebih jauh — diganti dengan pendekatan lebih sederhana (harga flat per hari, bisa di-override per sumur), karena struktur tarif resminya bersifat rahasia/confidential dan belum pernah dikonfirmasi detailnya.

---

## 2.6 Pembaruan Header A-Q (v14)
Sistem diperbarui untuk mendukung format ekspor terbaru dengan header A-Q:
- **Header Baru**: `WELLNAME`, `UWI`, `COMM_PERCENT`, `COMM_STATUS`, `CONTROLLER_TYPE`, `LASTGOOD_SCANTIME`, `LASTGOOD_SCANDATE`, `FLOW_RATE`, `HOURLY_RUNTIME`, `INTERNAL_TEMP_C`, `SUPPLY_VOLTAGE`, `BATTERY_VOLTAGE`, `INSERT_DATE`, `RTU_ID`, `DAILY_FLOW_RATE`, `HOURLY_FLOW_RATE`, `GRAND_TOTAL_RATE`.
- **Logika Cerdas**: `buildColumnMap` mendukung alias (misal `WELLNAME` atau `NodeID` keduanya dikenali sebagai identitas sumur).
- **Penanganan Summary vs Mentah**: Jika input berupa 1 baris per hari dengan kolom `COMM_PERCENT`, sistem menggunakan nilai tersebut sebagai availability. Jika input berupa data per menit, sistem tetap menghitung berbasis 1440 baris.
- **Detail Field**: Field tambahan seperti `UWI`, `ControllerType`, dan `HourlyRuntime` kini ditangkap dan ditampilkan di modal Verifikasi Manual.

---

## 3. Modul 2 — Pressure Data

### 3.1 Kenapa Dibutuhkan
Senior menjelaskan ada data lain, "Pressure Data" (data tekanan), yang perlu dihitung availability-nya dengan cara serupa NUFLO (basis 1440 menit/hari). Bedanya, data ini datang dari **2 sumber berbeda** yang mencatat titik pengukuran yang SAMA:
- **Data Mobilkom** — dicatat oleh alat milik Mobilkom sendiri, 1 file per hari, interval waktu tidak rapi (kadang 5 menitan, sering bolong).
- **Data Mitra** (awalnya dicontohkan "PHR", tapi digeneralisasi karena bisa jadi PT lain) — dicatat pihak mitra, 1 file besar per bulan, granularitas sangat rapat (2 baris per menit).

### 3.2 Perbedaan Struktur Data dari NUFLO
Di NUFLO, nama sumur ada di **dalam isi kolom** (`NodeID`). Di Pressure Data, setiap **titik pengukuran adalah kolom terpisah** (misal `PTN_GS_PIT_P1001A`, `P1001B`, dst) — jadi 1 file bisa berisi banyak titik sekaligus, dicatat berdampingan dalam baris yang sama.

### 3.3 Rumus yang Disepakati
```
Availability (%) = (Jumlah baris/menit unik yang ada datanya per Titik per Tanggal ÷ 1440) × 100
Status: sama seperti NUFLO (≥90% = 1, <90% = 0)
```
**Penting**: "menit unik" di sini konsepnya SAMA PERSIS dengan "jumlah baris" di NUFLO. Bedanya cuma soal kebersihan data — NUFLO secara alami 1 baris = 1 menit (nggak pernah dobel), sedangkan Pressure Data (khususnya data Mitra) kadang 1 menit dicatat 2× (jam `:00` dan `:30`). Untuk menit yang double-dicatat begini, sistem hanya mengambil **baris pertama secara waktu** dan membuang baris duplikatnya (sesuai instruksi senior), baru dihitung `jumlah baris ÷ 1440 × 100`. Kalau tidak dibersihkan dulu, availability bisa lebih dari 100% yang tidak masuk akal.

### 3.4 Kolom yang Diabaikan Otomatis
Beberapa kolom di data Mobilkom (`Pressure6`, `Pressure7`, `Pressure8`) ternyata isinya selalu 0 (placeholder/belum dipakai, dikonfirmasi oleh senior). Alih-alih hardcode nama kolom yang harus diabaikan, sistem otomatis mendeteksi: **kolom yang isinya SELALU 0 di seluruh data dikeluarkan dari perhitungan** — supaya tetap jalan walau nanti ada file dengan nama kolom kosong yang berbeda.

### 3.5 Kolom "RTU"
Ditemukan lewat contoh laporan referensi ("Petani GS") yang formatnya kesamping (1 baris per tanggal, banyak kolom titik + status bayar). Ada kolom `RTU` di samping `PT1`...`PT5` yang sempat membingungkan karena:
- Bukan kolom asli di data mentah (cuma ada 5 kolom `PTN_GS_PIT_*`, tidak ada kolom literal bernama RTU).
- Angka di contoh laporan tidak cocok kalau dihitung ulang dari file mentah yang tersedia (sempat diduga contoh dari periode/lokasi lain, tapi dikonfirmasi itu **data asli**, bukan contoh format — jadi kemungkinan besar filenya beda dari yang diberikan ke Claude).

**Terpecahkan** setelah senior menjelaskan konsep RTU: *"RTU itu merupakan sebuah induk dari data pressure — alat komunikasi/pengukur yang ada di pipa, dan statusnya dibuat sesuai apakah availability-nya sudah mencapai 90% atau belum."* Berdasarkan itu, hipotesis **RTU = nilai availability TERTINGGI di antara semua titik (PT1...PTn) pada tanggal itu** dicoba dan **cocok 100%** saat diverifikasi manual terhadap seluruh baris di contoh laporan "Petani GS" (rasionalnya: RTU dianggap "hidup" kalau minimal 1 titik yang tersambung ke dia berhasil lapor). Rumus ini sudah diimplementasikan di export Excel.

### 3.6 Perjalanan Desain UI (berubah beberapa kali)
1. **v1 (awal)** — 1 tabel gabungan sederhana, grid 1440 kotak untuk detail per menit.
2. **v2 (split-screen)** — diubah jadi 2 panel kiri-kanan terpisah total (Mobilkom kiri, Mitra kanan) karena permintaan "biar nggak bentrok data". Fitur perbandingan otomatis muncul di bawah kalau 2 panel sudah ada data.
3. **v3 (balik ke gabungan, tapi lebih rapi)** — split-screen dianggap kurang praktis (terlalu banyak elemen berulang), diminta balik ke 1 tabel gabungan tapi dengan tampilan yang lebih baik: sparkline mini per baris (pengganti teks "rentang jam tercatat" yang membingungkan), ruler menit + info bar hover di modal detail, tombol "Cek Perhitungan" (verifikasi manual mirip NUFLO), dan auto-deteksi kolom kosong.
4. **v4 (sekarang)** — diagram flowchart proses (linear + melingkar) di bagian perbandingan diganti total menjadi **diagram hasil** (donut chart proporsi Cocok/Perlu Ditinjau + bar chart rata-rata selisih per titik) plus penjelasan teks otomatis, karena flowchart proses dianggap tidak informatif untuk melihat HASIL perbandingannya. Export Excel juga diubah: RTU ditambahkan dengan header persis seperti contoh referensi, dan opsi export tidak lagi otomatis menggabung Mobilkom+Mitra jadi 1 sheet — sekarang ada dropdown pilihan (Semua Sumber / Mobilkom saja / Mitra saja), tetap dalam sheet terpisah per sumber.

### 3.7 Bug yang Ditemukan & Diperbaiki
1. **Kolom "datetime" berisi epoch, bukan tanggal** — di file Mobilkom, kolom bernama `datetime` ternyata isinya angka epoch milidetik (`1780254986670`), sementara kolom `timestamp` yang justru berisi tanggal terbaca manusia (`06/01/2026 02:16:26`) — namanya kebalik dari dugaan wajar. Kalau tidak ketangkap, semua perhitungan tanggal akan salah total. Diperbaiki: sistem memilih kolom waktu berdasarkan **isi datanya** (apakah terlihat seperti tanggal/serial Excel yang wajar — antara 1 dan 100.000), bukan cuma nama kolom.
2. **Timezone shift** — semua parsing tanggal/jam pakai getter UTC (`getUTCFullYear`, dst) secara konsisten di kedua modul, supaya tidak bergeser 1 hari tergantung timezone browser pengguna.

---

## 4. Arsitektur Teknis

Aplikasi web statis murni (tanpa backend/server), dibuka langsung dari `index.html` di browser.

```
nuflo/
├── index.html   → struktur HTML kedua modul (NUFLO + Pressure Data), dipisah lewat menu hamburger (☰)
├── style.css     → seluruh styling
├── script.js      → logic modul NUFLO (mandiri, tidak berbagi state dengan pressure.js)
├── pressure.js     → logic modul Pressure Data (mandiri)
├── README.md       → dokumentasi cara pakai & rumus (untuk pengguna akhir)
└── PROJECT.md      → dokumen ini (riwayat & konteks pengembangan)
```

### Library eksternal (via CDN)
- **SheetJS (xlsx)** — membaca file Excel/CSV di sisi browser.
- **ExcelJS** — menulis file Excel dengan styling, warna, dan rumus (SheetJS tidak mendukung ini untuk versi gratisnya).
- **jsPDF + jspdf-autotable** — export PDF.
- **Chart.js** — semua grafik (trend availability, perbandingan antar titik, donut/bar hasil perbandingan).

### Prinsip Desain Penting
- **Modul NUFLO dan Pressure Data 100% independen** — tidak ada variabel global yang dipakai bersama, supaya perubahan di satu modul tidak pernah mengganggu modul lainnya (ini eksplisit diminta dan selalu diverifikasi lewat `diff` sebelum setiap rilis).
- **Auto-deteksi lebih diutamakan daripada hardcode** — nama kolom waktu, kolom yang harus diabaikan (selalu 0), dan sheet yang dipakai semuanya dideteksi otomatis dari isi data, bukan ditulis manual, supaya tetap tahan banting kalau format file sedikit berbeda di kemudian hari.
- **Semua rumus dan bug diverifikasi dengan data asli** sebelum kode diserahkan — bukan sekadar tebakan, memakai skrip Node.js terpisah untuk mensimulasikan kode produksi terhadap file Excel/CSV yang sesungguhnya.

---

## 5. Audit Besar & Perbaikan Model 3-Status (v9)

Setelah beberapa kali export dicurigai janggal (angka tidak konsisten, kolom kosong, tanggal PHR ikut ketuker dengan Mobilkom), dilakukan audit menyeluruh dengan cara menjalankan ulang kode produksi asli (bukan simulasi) langsung terhadap file mentah, dibandingkan baris-per-baris dengan hasil export yang dipertanyakan. Temuan-temuan pentingnya:

1. **Ditemukan teks "Not Connect" tersebar di ~43% sel data pressure milik mitra** — sebelumnya diasumsikan semua sel berisi angka atau kosong saja. Sistem sudah menangani ini dengan benar sejak awal (nilai teks otomatis gagal di-parse jadi angka, sehingga tidak ikut dihitung), tapi belum dibedakan secara eksplisit dari "menit yang sama sekali tidak tercatat". Direfaktor jadi model 3-status: **Connected / Not Connect / Tidak Tercatat**, dengan `notConnectCount` dan `trulyMissingCount` sebagai field terpisah pada setiap hasil hitungan.
2. **Data dari sesi test sebelumnya beberapa kali ikut "nyangkut"** ke hasil export (misal PHR yang seharusnya mulai Juni malah kebawa data Mei dari Mobilkom) — dikonfirmasi ini BUKAN bug pencampuran data antar sumber (dites ulang di sesi baru yang benar-benar bersih, terbukti PHR dan Mobilkom tetap terpisah sempurna), melainkan sisa state di memori browser dari pengujian berulang di tab yang sama tanpa refresh. Solusinya: ditambahkan tombol eksplisit **"🗑 Reset Semua Data Pressure"**.
3. **Bug nyata ditemukan**: kolom "Selisih" dan "Selisih Avg" di file export perbandingan (`Perbandingan_Pressure.xlsx`) ditulis sebagai rumus Excel mentah (`=C4-D4`) tanpa nilai hasil hitungnya disertakan. ExcelJS (library yang dipakai menulis file) tidak menjalankan mesin kalkulasi — jadi nilai itu cuma "muncul" kalau file dibuka di Excel/LibreOffice asli yang otomatis menghitung ulang formula saat dibuka. **Diperbaiki**: nilai Selisih dihitung dulu di JavaScript, baru ditulis sebagai angka pasti.
4. Ditambahkan verifikasi otomatis (lewat skrip Node.js terpisah yang menjalankan kode produksi asli) bahwa Mobilkom & data mitra benar-benar independen (tidak ada satu pun baris yang identik antara keduanya saat diaudit 31 hari penuh).

## 5b. Kelola Data (v10)

Fitur yang ditambahkan:
- **Status "data sudah ada belum"** ditampilkan otomatis di atas kotak upload sebelum file diproses, supaya user sadar kalau sumber itu sudah punya data dan bisa memilih mode Upload Baru/Tambahkan dengan tepat.
- **Checkbox pilih & hapus baris tertentu** di tabel detail — bisa dikombinasikan dengan filter yang sudah ada buat mempersempit dulu, baru pilih massal lewat checkbox di header tabel.
- **Kolom "Rincian Menit (C / NC / TT)"** langsung di tabel utama — breakdown Connected/Not Connect/Tidak Tercatat tanpa perlu buka modal.
- Dikonfirmasi ulang (dan didokumentasikan di sini) bahwa **export per sumber sudah independen sejak awal** — sheet Mobilkom dan sheet Mitra masing-masing pakai rentang tanggalnya sendiri, tidak pernah dipaksa selaras/gabung berdasarkan tanggal.

Sempat muncul permintaan untuk memberi opsi manual pilih basis hitung 1440/2880 per baris. Diputuskan **TIDAK** menambahkan toggle manual (karena berisiko membuat fitur Perbandingan tidak bisa diandalkan lagi kalau tiap baris boleh beda basis), dan sebagai gantinya ditambahkan field transparansi (baris mentah vs hasil dipadatkan) di modal Cek Perhitungan — fitur ini kemudian **dihapus lagi di v12** setelah rumus basis-ganda diformalkan (lihat 5c).

## 5c. Keputusan Final Soal 1440 vs 2880 (v12)

Setelah eksplorasi panjang di v10 dan diskusi lanjutan, senior mengonfirmasi lewat contoh pivot table Excel-nya sendiri bahwa pendekatan yang benar BUKAN memadatkan data 30-detik jadi basis 1440 seperti asumsi sebelumnya, melainkan:

1. Hitung availability memakai basis harian **ASLI** sumber itu — 1440 kalau datanya 1×/menit (Mobilkom), **2880** kalau datanya 2×/menit (PHR), dan seterusnya untuk granularitas lain.
2. Karena hasilnya sama-sama berupa **persentase** (0–100%), perbandingan antar sumber otomatis apple-to-apple tanpa perlu konversi tambahan — dibuktikan matematis bahwa "konversi 2880→1440 dulu baru dibandingkan" secara aljabar identik dengan "langsung bagi 2880" (pembilang dan penyebut sama-sama dibagi 2, hasil baginya tidak berubah).
3. Granularitas dideteksi **otomatis** per sumber (bukan hardcode nama Mobilkom/PHR): cek apakah ada tag yang punya 2+ baris berbeda dalam menit yang sama secara signifikan di datanya.

Diverifikasi terhadap contoh pivot table manual milik senior (`Book1.xlsx`, titik "1A", tanggal 30 Juni) sampai hasilnya **persis 90.00%** — sebelumnya sempat meleset (75.94%, lalu 90.83%) karena 2 bug teknis terpisah yang ditemukan di tengah proses:

- **Bug deteksi granularitas terlalu naif** — deteksi awal cuma melihat sebaran detik secara GLOBAL (apakah pernah ada detik <30 dan ≥30 di seluruh file), yang salah mendeteksi Mobilkom (yang detiknya bervariasi antar-menit karena jitter alat, walau tetap cuma 1 baris/menit) sebagai granularitas 2×/menit. Diperbaiki: deteksi sekarang mengecek betulan apakah 2+ baris jatuh DALAM MENIT YANG SAMA untuk tag yang sama.
- **Bug rounding floating-point pada serial tanggal Excel** — ditemukan saat angka masih meleset walau deteksi granularitas sudah benar. Serial tanggal Excel (pecahan hari) kadang menghasilkan Date JavaScript yang melenceng beberapa milidetik dari nilai "genap"-nya (mis. `00:02:00.000` yang seharusnya, malah kebaca `00:01:59.997`), menyebabkan sebagian slot 30-detik salah dikelompokkan ke menit sebelumnya dan "hilang" dari perhitungan. Diperbaiki dengan membulatkan ke detik terdekat sebelum diproses lebih lanjut.

Fitur "Verifikasi Silang: Baris Mentah vs Hasil Resmi" yang sempat ditambahkan di v10 **dihapus lagi** di versi ini — karena dengan pendekatan baru, tidak ada lagi bedanya "mentah" vs "resmi": setiap slot dihitung apa adanya sejak awal, jadi konsep itu sudah tidak relevan.

## 5d. Penyederhanaan Tampilan (v11)

Berdasarkan masukan bahwa beberapa bagian UI terasa "kebanyakan teks" (terlalu deskriptif/robotic), disederhanakan:
- Modal "Cek Perhitungan" difokuskan ke rumus saja, tabel data diubah dari contoh (10-15 baris) jadi **lengkap semua data** — supaya web ini bisa dipakai sebagai alat verifikasi sungguhan, bukan sekadar ilustrasi.
- Modal "Lihat Detail" (timeline) dipangkas jadi cuma grid warna + legenda — kartu ringkasan angka dan daftar teks rentang waktu dihapus.
- Chart perbandingan diganti dari bar chart statis (yang terlihat rata/tidak informatif) jadi line chart interaktif dengan dropdown pilih titik, membandingkan trend availability Mobilkom vs Mitra per tanggal.

## 5e. Modul 3 — OPM Verification (v13)

Modul OPM Verification membaca data log OPM (evaluasi reliability dan status verifikasi per parameter sensor).
- **Aturan Status Utama**: Mengacu pada `STATUS_COMPLIANCE` (atau `RELIABILITY ≥ 90%` → Accepted, `< 90%` → Rejected).
- **Ringkasan Harian & Bulanan Detail**: Dikelompokkan per kombinasi `RTU ID + Facility Name + OPS Team + Node Type`.
  - **Harian**: Per tanggal + RTU ID + Facility Name + OPS Team + Node Type, menghitung total record/hari, jumlah Accepted, jumlah Rejected, dan Accept Rate (%).
  - **Bulanan**: Per bulan + RTU ID + Facility Name + OPS Team + Node Type, menghitung total hari, jumlah hari Accepted, jumlah hari Rejected, dan Accept Rate (%).
- **Export Excel & PDF**: Sheet/halaman ringkasan harian dan bulanan menyertakan seluruh kolom identitas (`RTU ID`, `Facility Name`, `OPS Team`, `Node Type`) beserta angka summary `Accepted` & `Rejected`.

---

## 4. Modul 3 — OPM Verification (v1)

### 4.1 Kebutuhan
OPM (Operational Performance Monitoring) adalah sistem verifikasi data hasil monitoring RTU — setiap parameter sensor (`TEMP_1`, `TEMP_2`, `TEMP_3`, `TEMP_4`, `WATER_LEVEL`, `PRESSURE`) dicek: Accept (ada data valid) atau Reject (tidak ada data / data kosong).

File input hasil export OPM berisi:
- Identitas: `RTU_ID`, `REPORT_DATE`, `FACILITY_NAME`, `OPS_TEAM`, `NODE_TYPE`
- Status utama: `STATUS_COMPLIANCE` (Accepted/Rejected), `RELIABILITY` (%), `AVAILABILITY` (menit)
- Kolom parameter: `TEMP_1_NDC_VERIFICATION`, `TEMP_2_NDC_VERIFICATION`, ..., `PRESSURE_VERIFICATION`
- Nilai sensor terkait: `AVG_TEMP_1_NDC`, `AVG_TEMP_2_NDC`, ..., `AVG_PRESSURE`

### 4.2 Rumus & Aturan (Independent per Parameter)
```
STATUS_COMPLIANCE:
  - Dari kolom STATUS_COMPLIANCE (Accepted/Rejected)
  - ATAU auto-deteksi dari RELIABILITY: ≥90% → Accept, <90% → Reject

Setiap Parameter *_VERIFICATION (INDEPENDEN):
  - Accept: jika AVG_* terkait BUKAN kosong (ada angka)
  - Reject: jika kosong (tidak ada data)
  
Ringkasan Harian (per RTU + Facility + OPS Team + Node Type + Tanggal):
  - Total Record: jumlah baris data hari itu
  - Status Accept/Reject: count baris STATUS_COMPLIANCE = Accepted/Rejected
  - Accept Rate (%): (Status Accept / Total Record) × 100
  - Per Parameter: jumlah baris yang Accept (independent, tidak tergantung parameter lain)

Ringkasan Bulanan (per RTU + Facility + OPS Team + Node Type + Bulan):
  - Aggregate dari seluruh hari di bulan itu
  - Status Accept/Reject: sum dari semua Accept/Reject di bulan
  - Per Parameter: sum total baris Accept di seluruh bulan
```

**Penting**: Breakdown parameter dihitung langsung dari jumlah baris mentah, bukan dari "berapa hari yang Accept". Setiap hari bisa punya record berbeda untuk setiap parameter.

### 4.3 Fitur
- Deteksi otomatis semua kolom `*_VERIFICATION` yang ada di file (dinamis, tidak hardcoded).
- Ringkasan Harian: detail per hari, breakdown Accept count per parameter.
- Ringkasan Bulanan: agregat per bulan, breakdown Accept count per parameter.
- Export Excel: 4 sheet (Detail OPM, Ringkasan Harian, Ringkasan Bulanan, Data Gabungan).
- Export PDF: 3 halaman (detail, harian, bulanan).
- Tab navigasi: Ringkasan Harian, Ringkasan Bulanan, Analisis Parameter (chart Accept/Reject per parameter).
- Tabel header dinamis: kolom parameter auto-adjust sesuai apa yang terdeteksi di file.

### 4.4 Pembaruan Terbaru (v1 Final)
- **Header dinamis pada Ringkasan Harian & Bulanan**: Kolom parameter ditambahkan otomatis saat data diproses, tidak hardcoded 6 parameter (TEMP_1-4, WATER_LEVEL, PRESSURE). Kalau file punya 10 jenis parameter, semua 10 akan tampil.
- **Kolom "Status Accept/Reject"**: Dipisahkan menjadi 2 kolom terpisah (bukan cuma "Status") untuk clarity — berapa baris Accept, berapa baris Reject per hari/bulan.
- **Warna row**: Hijau (semua Accept), Merah (semua Reject), Kuning (mixed).
- **Perhitungan independent**: Setiap parameter dihitung sendiri-sendiri dari jumlah baris, tidak tergantung status parameter lain atau STATUS_COMPLIANCE utama.

---

## 5. Perbaruan NUFLO Export Format (v14 Final)

### 5.1 Sheet "Detail Harian" — Format Baru
Dimulai dari versi ini, sheet "Detail Harian" di export Excel diubah dari **17 kolom** (termasuk UWI, CONTROLLER_TYPE, DAILY_FLOW_RATE, HOURLY_FLOW_RATE, GRAND_TOTAL_RATE) menjadi **10 kolom** yang lebih fokus:

```
WELLNAME | RTU_ID | DATE | #DATA | AVAILABILITY (%) | #DATA PAY | AVG FLOW_RATE | AVG INTERNAL_TEMP_C | AVG SUPPLY_VOLTAGE | AVG BATTERY_VOLTAGE
```

**Alasan perubahan**: Format ini sesuai dengan laporan referensi resmi yang digunakan di operasional (MONTHLY SUMMARY DATA REPORT - WIW ONLINE MONITORING), jadi lebih mudah diverifikasi manual ke laporan asli.

**Kontrak Info (tetap di atas)**: Request Order, Periode, Start Date, End Date, Contract No, Contract Title.

**Warna**: Hijau (Status=1, Accept/Availability≥90%), Merah (Status=0, Reject/Availability<90%).

**Format Number**: 
- Availability: `0.00"%"` (custom, bukan format Percentage bawaan Excel)
- AVG fields: `#,##0.0000` (4 decimal)

### 5.2 Backward Compatibility
Sheet "Billable WIW Online Monitoring" (ringkasan per sumur + service codes) tetap tidak berubah — masih 10 kolom: No, Location Name, RTU Tipe, RTU ID, #Data, SER-02, SER-04, SER-18, Total, Grand Total.

---

## 6. Status Saat Ini & Hal yang Masih Terbuka

- ✅ Modul NUFLO: lengkap v14, teruji, format export diperbarui sesuai referensi resmi.
- ✅ Modul Pressure Data: lengkap termasuk kolom RTU, teruji dengan data asli.
- ✅ Modul OPM Verification: v1 final — ringkasan harian/bulanan detail per RTU dengan header dinamis, independent per parameter, export Excel/PDF.
- ⚠️ Harga/tagihan untuk Pressure Data belum dibahas (NUFLO sudah ada fitur harga, Pressure Data belum) — kalau nanti dibutuhkan, bisa ditambahkan dengan pola yang sama seperti NUFLO (harga default + override per titik).
- ⚠️ Struktur tarif resmi (kode layanan SER-01/05/07 dsb) belum diimplementasikan karena sifatnya rahasia/confidential dan belum pernah dikonfirmasi detail lengkapnya.

---

## 7. Cara Melanjutkan Percakapan Ini

Kalau ada perubahan/bug baru, kirim contoh file data yang bermasalah beserta penjelasan hasil yang diharapkan. Setiap rumus dan bug fix di proyek ini SELALU diverifikasi dulu memakai data asli (bukan ditebak), jadi lampirkan file asli setiap kali melaporkan sesuatu yang terasa janggal, supaya bisa dicek ulang persis di titik mana bedanya.

**Checklist sebelum rilis/deploy**:
- [ ] Test ketiga modul (NUFLO, Pressure Data, OPM) dengan file data asli terbaru
- [ ] Verify Excel export: header sesuai, format number benar, warna highlight tepat, sorting benar
- [ ] Verify PDF export: halaman tercukupi, tabel tercetak rapi, font & ukuran terbaca
- [ ] Test upload file besar (>10.000 baris) — performa & memory usage
- [ ] Test di browser berbeda (Chrome, Firefox, Edge) — CSS & JS kompatibel
- [ ] Baca ulang README & PROJECT.md — update dengan perubahan terbaru, jangan sampai dokumentasi ketinggalan

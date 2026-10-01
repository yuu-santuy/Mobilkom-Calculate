# CEOR Data Web Application

Aplikasi web berbasis browser untuk mengunggah, membersihkan, menganalisis, dan meringkas data telemetri CEOR (Continuous Emission / Operation Telemetry Record) dari file CSV, XLS, dan XLSX.

---

## 📌 Fitur Utama

- **Multi-Format Upload**: Mendukung file `.csv`, `.xls`, dan `.xlsx` melalui dialog file browser maupun Drag & Drop.
- **Mode Buka & Tambah Data (Append)**: Mampu menggabungkan data dari beberapa file sekaligus.
- **Deduplikasi Menit Unik (Unique Minute Binning)**: Mencegah duplikasi data telemetri historis/timestamp per NodeID pada menit yang sama.
- **Kalkulasi Metrik Otomatis**:
  - `total data`: 1.440 menit per hari penuh (24 jam × 60 menit).
  - `good data`: Jumlah menit unik yang memiliki pembacaan valid (maks. 1.440).
  - `avgpressure`: Rata-rata nilai *pressure* dari menit valid.
  - `avg flow`: Rata-rata nilai *flow* dari menit valid.
  - `availbilty`: Persentase ketersediaan data terhadap target harian (dicapping maksimal 100,00%).
  - `press 1` & `flow 1`: Indikator ketersediaan parameter (1 jika ada data numerik, NULL jika kosong).
- **Statistik & Ringkasan Realtime**: Kartu metrik total Node ID, total hari data, total baris raw data, dan rata-rata availability.
- **Filter Fleksibel**: Filter berdasarkan Node ID (dropdown & pencarian teks) serta rentang tanggal (*start date* dan *end date*).
- **Tabel Ringkasan (Summary) & Detail Data Harian**:
  - **Tabel Ringkasan (6 Kolom)**: `Node ID`, `Periode/Bulan` (contoh: "Agustus 2026"), `Total Hari`, `Availability (%)`, `Accept Press` (jumlah hari status Pressure $\ge 90\%$), dan `Accept Flow` (jumlah hari status Flow $\ge 90\%$).
  - **Tabel Detail Data Harian**: Rincian per tanggal lengkap dengan rata-rata nilai dan status sensor.
- **Ekspor Laporan Multi-Sheet**:
  - **Excel (.xlsx)** 2 Sheet:
    - Sheet 1: `"Summary"` (hanya berisi tabel ringkasan 6 kolom).
    - Sheet 2: `"Detail Data"` (berisi rincian data harian per tanggal).
  - **PDF (.pdf)** landscape via jsPDF & AutoTable siap cetak.

---

## 🧮 Logika & Rumus Perhitungan

### 1. Target Waktu Harian
$$\text{total\_data} = 24 \times 60 = 1.440\text{ menit}$$

### 2. Deduplikasi Menit Unik
Data dikelompokkan berdasarkan `NodeID` dan tanggal `YYYY-MM-DD`. Setiap baris telemetri diekstrak cap waktunya hingga presisi menit:
$$\text{minuteKey} = \text{YYYY-MM-DD HH:mm}$$

Satu menit dihitung sebagai 1 unit data jika terdapat nilai *Pressure* atau *Flow* yang valid (numerik, bukan NULL/NaN/kosong). Baris ganda pada menit yang sama dalam satu NodeID digabungkan (di-deduplikasi), bukan dijumlahkan.

### 3. Availability & Capping
$$\text{good\_data} = \min(\text{jumlah menit unik valid}, 1.440)$$

$$\text{availability (\%)} = \min\left(\left(\frac{\text{good\_data}}{1.440}\right) \times 100, 100.00\right)$$

$$\text{rata\_rata\_availability} = \min\left(\frac{1}{N}\sum_{i=1}^{N} \text{availability}_i, 100.00\right)$$

---

## 📂 Struktur File

```
CEOR web/
├── index.html                  # Struktur markup antarmuka & layout dashboard
├── ceor.js                     # Logika inti: parsing, grouping, kalkulasi, filter, ekspor
├── style.css                   # Berkas styling pendukung
├── README.md                   # Dokumentasi penggunaan aplikasi
├── project.md                  # Spesifikasi teknis, arsitektur & catatan bugfix
└── CEOR Data 12 Agust 2026.csv # Contoh dataset telemetri mentah
```

---

## 🚀 Cara Menjalankan

Aplikasi berjalan murni di sisi klien (*client-side*), tidak memerlukan server backend atau build step:

1. Buka file `index.html` langsung menggunakan browser modern (Chrome, Edge, Firefox).
2. Tarik dan lepas file CSV/Excel ke area drop zone, atau klik tombol **Buka File Baru**.
3. Dashboard akan langsung menghitung metrik dan menampilkan tabel ringkasan.
4. Gunakan filter untuk memilah Node ID atau rentang tanggal tertentu.
5. Klik **Ekspor Excel** atau **Ekspor PDF** untuk mengunduh laporan ringkasan.

---

## 🛠️ Dependensi Eksternal (CDN)

- **Bootstrap 5.3.2** (CSS & JS Bundle)
- **Bootstrap Icons 1.11.3**
- **SheetJS (xlsx.full.min.js 0.18.5)**: Pembaca & penulis spreadsheet
- **jsPDF 2.5.1 & jsPDF-AutoTable 3.5.31**: Pembuat dokumen PDF tabel

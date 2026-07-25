# Standard Operating Procedure (SOP) & Security Backlog
## Penanganan Laporan Audit Keamanan Pihak Ketiga — Platform Kelas Markaz Fiqih

Dokumen resmi ini mengatur alur kerja, standar klasifikasi risiko, prosedur validasi teknis, serta matriks pelacakan perbaikan (*Security Backlog Tracker*) apabila platform Kelas Markaz Fiqih menerima laporan audit atau temuan kerentanan (*vulnerability report*) dari spesialis/auditor pihak ketiga.

---

## 1. Prinsip Utama Penanganan Laporan

1. **Objektivitas & Analisis Mendalam:**
   Dilarang keras langsung mengimplementasikan atau menolak temuan audit tanpa melalui tahapan verifikasi teknis dan analisis dampak (*impact assessment*) terlebih dahulu.
2. **Tanpa Rekayasa / Transparansi:**
   Seluruh temuan wajib diklasifikasikan secara jujur berbasis risiko aktual pada arsitektur sistem.
3. **Pelacakan Terpusat:**
   Setiap temuan yang terverifikasi wajib dicatat dalam **Security Backlog Tracker** (Tabel Bagian 5) dan dipantau hingga perbaikan selesai serta terverifikasi ulang (*re-tested*).

---

## 2. Matrix Klasifikasi Risiko (Risk Rating Scale)

Auditor pihak ketiga atau tim internal mengelompokkan setiap temuan ke dalam 5 tingkatan risiko berbasis standar OWASP / CVSS v3.1:

| Level Risk | Deskripsi & Contoh Kerentanan | SLA Perbaikan (Fix Window) | Penanggung Jawab |
| :--- | :--- | :--- | :--- |
| 🔴 **Critical (P1)** | Remote Code Execution (RCE), Authentication Bypass, Unrestricted SQL Injection, Direct DB Hijack. | **< 24 Jam** | Lead Security & Core Dev |
| 🟠 **High (P2)** | Stored XSS, Privilege Escalation (User to Admin), Broken Object Level Authorization (BOLA/IDOR). | **< 72 Jam** | Backend / Frontend Lead |
| 🟡 **Medium (P3)** | Reflected XSS, CSRF pada fitur non-kritis, Sensitive Data Exposure di API response. | **< 7 Hari** | Engineering Team |
| 🔵 **Low (P4)** | Missing Security Headers (CSP/HSTS), Verbose Error Stacktraces, Open Redirect. | **< 14 Hari** | Engineering Team |
| ⚪ **Info (P5)** | Rekomendasi Hardening, Best Practice Code Conventions, Informasi versi library outdated. | **Maintenance Schedule** | DevOps / Maintenance |

---

## 3. Alur Kerja 4 Langkah Pasca-Penerimaan Dokumen Audit

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Step 1: Receipt & Triage (Penerimaan Laporan & Registrasi Backlog)       │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Step 2: Verification & PoC (Uji Reproduksi: True vs False Positive)       │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Step 3: Decision Matrix (Fix / Mitigate / Accept Risk / Dispute)         │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Step 4: Remediation & Re-testing (Eksekusi Fix & Verifikasi Ulang)       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Detail Langkah:
1. **Step 1: Receipt & Triage**
   - Terima dokumen audit resmi dari pihak ketiga.
   - Buat entri baru pada Security Backlog Tracker dengan status `UNTRIAGED`.
2. **Step 2: Verification & Proof of Concept (PoC)**
   - Lakukan uji coba reproduksi kerentanan pada lingkungan *staging/sandbox*.
   - Konfirmasi status temuan:
     - **True Positive (TP):** Kerentanan terbukti dapat dieksploitasi.
     - **False Positive (FP):** Temuan tidak valid atau tertahan oleh lapisan perlindungan lain.
3. **Step 3: Decision Matrix & Sikap Resmi**
   - Tentukan salah satu posisi resmi tim teknis:
     - ✅ **FIX:** Dibuatkan perbaikan kode/tambalan (*patch*) langsung.
     - 🛡️ **MITIGATE:** Diberikan kontrol keamanan tambahan (misal: WAF rule/rate-limiting) jika perbaikan struktur membutuhkan waktu lama.
     - ⚠️ **ACCEPT RISK:** Risiko diterima secara sadar apabila dampak sangat minim & mitigasi mengganggu fungsionalitas bisnis utama.
     - ❌ **DISPUTE:** Bantahan teknis resmi kepada auditor disertai bukti PoC jika temuan dinyatakan *False Positive*.
4. **Step 4: Remediation & Re-Testing**
   - Eksekusi perbaikan kode.
   - Lakukan verifikasi ulang (*re-test*) dan mintalah auditor untuk melakukan *rescan*.
   - Perbarui status di Security Backlog menjadi `RESOLVED & VERIFIED`.

---

## 4. Checklist Keamanan Standar Platform

- [x] **Authentication Security:** Strict Supabase JWT validation & Row Level Security (RLS) pada tabel `enrollments`, `classes`, `vouchers`, dan `users`.
- [x] **Authorization Checks:** Middleware `RequireAdminRoute` pada seluruh rute sensitif `/admin/*`.
- [x] **Database Access:** Client-side query dibatasi oleh RLS Supabase; service key tidak pernah diekspos ke frontend client.
- [x] **Input Sanitization & Type Safety:** 100% TypeScript strict type checking & sanitasi input slug.
- [x] **Transport Security:** Paksa HTTPS / HSTS pada level Edge CDN (Vercel/Cloudflare).

---

## 5. Security Backlog Tracker (Live Audit Log)

*Tabel pelacakan ini diperbarui secara berkala setiap kali dokumen audit keamanan dari auditor pihak ketiga diterima.*

| Issue ID | Date Reported | Severity | Vulnerability Summary | Affected Endpoint / Module | Status | Target Fix | Decision | Action Taken |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SEC-2026-001` | 2026-07-25 | 🔵 Low | Missing Security Headers in Vercel Deployment | Edge Header Response | `RESOLVED` | 2026-07-26 | Fix | Configured CSP & HSTS header policy |
| `SEC-2026-002` | 2026-07-25 | ⚪ Info | Open Graph Metadata Scrape Caching | `/opengraph.svg` | `VERIFIED` | N/A | Accept Risk | Scraper cache automated via debugger tools |

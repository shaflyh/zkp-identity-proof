
# 🛡️ ZKP Identity Proof

Proyek ini menggunakan **Zero Knowledge Proof (ZKP)** untuk membuktikan bahwa seorang pengguna mengetahui data identitas (seperti NIK, Nama, TTL) yang cocok dengan hash identitas yang telah diverifikasi — tanpa harus memperlihatkan data aslinya.

Teknologi yang digunakan:
- Circom (circuit definition)
- SnarkJS (trusted setup, proof, dan verifikasi)
- Poseidon hash dari circomlibjs

---

## 📁 Struktur Folder

```
circuits/                 // File circuit (.circom)
build/                    // File hasil kompilasi dan proof (auto-generated)
scripts/
  ├── setup.js            // Setup trusted key dan kompilasi circuit
  ├── generate_input.js   // Membuat file input.json dengan hash identitas
  ├── generate_proof.js   // Menghasilkan witness & proof
  └── verify_proof.js     // Verifikasi proof secara lokal
contracts/                // Verifier Solidity (hasil export snarkjs)
input.json                // Input data pengguna (NIK, nama, TTL)
```

---

## 📜 Script yang Tersedia (`package.json`)

```json
"scripts": {
  "zkp:setup": "node scripts/setup.js",
  "zkp:input": "node scripts/generate_input.js",
  "zkp:generate": "node scripts/generate_proof.js",
  "zkp:verify": "node scripts/verify_proof.js"
}
```

| Script | Fungsi |
|--------|--------|
| `zkp:setup` | Kompilasi circuit dan setup Groth16 trusted key |
| `zkp:input` | Membuat file input.json (berisi data identitas + hash) |
| `zkp:generate` | Menghasilkan witness & proof dari input |
| `zkp:verify` | Memverifikasi proof menggunakan verification key |

---

## 🚀 Cara Menjalankan

```bash
# 1. Instalasi dependency
npm install

# 2. Kompilasi dan trusted setup
npm run zkp:setup

# 3. Buat input untuk pengguna (data privat + hash publik)
npm run zkp:input

# 4. Generate witness dan proof dari input
npm run zkp:generate

# 5. Verifikasi proof
npm run zkp:verify
```

---

## ⚠️ Catatan
- Pastikan file `pot12_final.ptau` tersedia di root folder proyek.
- Kamu membutuhkan `circom` dan `snarkjs` secara global:
  ```bash
  npm install -g circom snarkjs
  ```
- Instal circomlibjs untuk hashing Poseidon:
  ```bash
  npm install circomlibjs
  ```
- Jika circom bermasalah, gunakan [Circom V2](https://docs.circom.io/getting-started/installation/#installing-circom).

---


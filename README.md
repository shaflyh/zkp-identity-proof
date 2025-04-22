
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
  "zkp:proof": "node scripts/generate_proof.js",
  "zkp:verify": "node scripts/verify_proof.js"
}
```

| Script | Fungsi |
|--------|--------|
| `zkp:setup` | Kompilasi circuit dan setup Groth16 trusted key |
| `zkp:input` | Membuat file input.json (berisi data identitas + hash) |
| `zkp:proof` | Menghasilkan witness & proof dari input |
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


# 🧾 Smart Contract — IdentityZKP (Zero Knowledge Proof untuk Identitas)
---

## ⚙️ Persiapan Environment

1. Ganti nama file `.env.example` menjadi `.env`, dan isi dengan variabel berikut:

```
PRIVATE_KEY=0x...
POLYGON_AMOY_RPC=https://polygon-amoy.infura.io/v3/your_project_id
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```
📎 Dapatkan API Key Polygon di: [https://polygonscan.com/](https://polygonscan.com/)

---

## 🔎 Verifikasi Lokal Proof

Sebelum mengirimkan proof ke smart contract, kamu dapat memverifikasi ZKP dengan snarkjs:

```bash
snarkjs groth16 verify build/verification_key.json build/public.json build/proof.json
```

---

## 🔨 Kompilasi & Pengujian Lokal

```bash
npx hardhat compile
npx hardhat test
```

---

## 🚀 Deploy ke Polygon Amoy (Testnet)

Gunakan Hardhat Ignition untuk melakukan deploy:

```bash
npx hardhat ignition deploy ignition/modules/identityZKP.js --network polygonAmoy
```

> ⚠️ Catatan: Jika ingin deploy ulang, hapus folder `ignition/deployments/` terlebih dahulu.
```bash
rm -rf ignition/deployments/
```

---

## 🔍 Verifikasi Kontrak

### ✅ Verifikasi Kontrak Verifier Saja

```bash
npx hardhat verify --network polygonAmoy alamat-kontrak-Groth16Verifier
npx hardhat verify --network polygonAmoy 0x54EbbDF1542b1c77fed3334BD786e2CBEb285488
```

### ✅ Verifikasi IdentityZKP (dengan argumen address Verifier)

```bash
npx hardhat verify --network polygonAmoy alamat-kontrak-IdentityZKP "alamat-kontrak-verifier"
npx hardhat verify --network polygonAmoy 0xbF20f1Ab4Fc6941C6DE02FA55c675044298Aa503 "0x54EbbDF1542b1c77fed3334BD786e2CBEb285488"
```
Note: Sesuaikan addressnya dengan address yang sudah kamu deploy sebelumnya.

Alamat Kontrak Terbaru:
IdentityModule#Groth16Verifier - 0x54EbbDF1542b1c77fed3334BD786e2CBEb285488
IdentityModule#IdentityZKP - 0xbF20f1Ab4Fc6941C6DE02FA55c675044298Aa503

---

## 🌐 Eksplorasi di Testnet

Lihat kontrak yang telah dideploy di Polygon Amoy:
[https://amoy.polygonscan.com/](https://amoy.polygonscan.com/)

---

## 📂 Struktur Proyek

```
contracts/
  ├── IdentityVerifier.sol     # Diexport dari snarkjs (verifier)
  └── IdentityZKP.sol          # Kontrak utama (menggunakan verifier)

ignition/modules/
  └── identityZKP.js           # Module deploy menggunakan Ignition
```

---
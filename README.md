
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
POLYGONSCAN_API_KEY=your_POLYGONSCAN_API_KEY
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

> Jika ingin deploy ulang, hapus folder `ignition/deployments/` terlebih dahulu.
```bash
rm -rf ignition/deployments/
```

Gunakan Hardhat Ignition untuk melakukan deploy:

```bash
npx hardhat ignition deploy ignition/modules/identityZKP.js --network polygonAmoy
```

Deploy Mainnet Polygon:
```bash
npx hardhat ignition deploy ignition/modules/identityZKP.js --network polygonMainnet
```

---

## 🔍 Verifikasi Kontrak

### ✅ Verifikasi Kontrak Verifier Saja

```bash
npx hardhat verify --network polygonMainnet alamat-kontrak-Groth16Verifier
npx hardhat verify --network polygonMainnet 0xE2BdD028DE585F80366CD0D4D30A502306FBF5e0
```

### ✅ Verifikasi IdentityZKP (dengan argumen address Verifier)

```bash
npx hardhat verify --network polygonMainnet alamat-kontrak-IdentityZKP "alamat-kontrak-verifier"
npx hardhat verify --network polygonMainnet 0xF99024c6E16c2dCCA305DAF4406b17D93F22a72f "0xE2BdD028DE585F80366CD0D4D30A502306FBF5e0"
```
Note: Sesuaikan addressnya dengan address yang sudah kamu deploy sebelumnya.

Alamat Kontrak Terbaru Mainnet:
IdentityModule#Groth16Verifier - 0xE2BdD028DE585F80366CD0D4D30A502306FBF5e0
IdentityModule#IdentityZKP - 0xF99024c6E16c2dCCA305DAF4406b17D93F22a72f

Alamat Kontrak Terbaru:
IdentityModule#Groth16Verifier - 0xA6867cBdAEe16953673D30d7918b1871C9e8FE81
IdentityModule#IdentityZKP - 0xe6A24597f07888CFe4371796A787B48DE1fdf5CE

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
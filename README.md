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
  ├── verify_proof.js     // Verifikasi proof secara lokal
  └── merkle-tree.js      // Utilitas untuk Merkle Tree (experimental)
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

## 🚀 Deploy ke Polygon

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

Deploy Mainnet Polygon:
```bash
npx hardhat ignition deploy ignition/modules/IdentityMerkleZKP.js --network polygonMainnet
```
IdentityMerkleZKPModule#Groth16Verifier - 0xfCC4762B60d64a992dfF7b18A59717Ac818e1C54
IdentityMerkleZKPModule#IdentityMerkleZKP - 0xE26aEE358266a10258860Fc862cceC2e2CAf50dc

---

## 🔍 Verifikasi Kontrak

### ✅ Verifikasi Kontrak Verifier Saja

```bash
npx hardhat verify --network polygonMainnet alamat-kontrak-Groth16Verifier
npx hardhat verify --network polygonMainnet 0xE2BdD028DE585F80366CD0D4D30A502306FBF5e0
npx hardhat verify --network polygonMainnet 0xfCC4762B60d64a992dfF7b18A59717Ac818e1C54
```

### ✅ Verifikasi IdentityZKP (dengan argumen address Verifier)

```bash
npx hardhat verify --network polygonMainnet alamat-kontrak-IdentityZKP "alamat-kontrak-verifier"
npx hardhat verify --network polygonMainnet 0xF99024c6E16c2dCCA305DAF4406b17D93F22a72f "0xE2BdD028DE585F80366CD0D4D30A502306FBF5e0"
npx hardhat verify --network polygonMainnet 0xE26aEE358266a10258860Fc862cceC2e2CAf50dc "0xfCC4762B60d64a992dfF7b18A59717Ac818e1C54" "0x0000000000000000000000000000000000000000000000000000000000000000"
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
## 🌿 Merkle Tree Implementation (Experimental)

⚠️ Fitur ini masih dalam tahap eksperimental dan belum sepenuhnya diuji atau di-deploy.

Implementasi terbaru menggunakan Merkle Tree untuk mengelola set identitas yang diapprove dan direvoke secara efisien:

- `IdentityZKPWithMerkle.sol` - Kontrak dengan dukungan Merkle Tree
- `scripts/merkle-tree.js` - Utilitas untuk membuat dan mengelola Merkle Tree

Keuntungan Merkle Tree:
- Validasi batch yang efisien
- Manajemen daftar identitas lebih terukur (scalable)
- Pengurangan biaya gas untuk operasi mass approval/revocation

---

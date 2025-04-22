const fs = require("fs");
const poseidon = require("circomlibjs").buildPoseidon;
const { toHex } = require("circomlibjs");

// Sample identity values (replace with real user input)
const nik = 3204280701000002n;
const namaHashed = 987654321n; // Assume name has been hashed or represented numerically
const ttl = 20000101n; // Format: YYYYMMDD as number
const key = 99999n; // Assume name has been hashed or represented numerically

async function generateInputJson() {
  const poseidonLib = await poseidon();

  const inputs = [nik, namaHashed, ttl, key];
  const hash = poseidonLib.F.toObject(poseidonLib(inputs));

  const inputObject = {
    nik: nik.toString(),
    nama: namaHashed.toString(),
    ttl: ttl.toString(),
    key: key.toString(),
    identityHash: hash.toString(),
  };

  fs.writeFileSync("input.json", JSON.stringify(inputObject, null, 2));
  console.log("✅ input.json generated successfully:");
  console.log(inputObject);
}

generateInputJson();

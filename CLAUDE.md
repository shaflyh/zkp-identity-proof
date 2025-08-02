# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Zero Knowledge Proof (ZKP) identity verification system using Circom circuits and Solidity smart contracts. The project proves knowledge of identity data (NIK, Name, Date of Birth) without revealing the actual data, supporting both simple hash verification and Merkle tree-based batch verification.

## Essential Commands

### ZKP Circuit Development
- `npm run zkp:setup` - Compile circuits and setup Groth16 trusted keys
- `npm run zkp:input` - Generate input.json with identity data and hash
- `npm run zkp:proof` - Generate witness and proof from input
- `npm run zkp:verify` - Verify proof using verification key

### Smart Contract Development
- `npx hardhat compile` - Compile Solidity contracts
- `npx hardhat test` - Run all tests
- `npx hardhat test test/IdentityZKP.js` - Run specific contract tests
- `npx hardhat test test/IdentityMerkleZKP.js` - Run Merkle ZKP tests

### Deployment (Polygon)
- `npx hardhat ignition deploy ignition/modules/IdentityZKP.js --network polygonAmoy` - Deploy to testnet
- `npx hardhat ignition deploy ignition/modules/IdentityMerkleZKP.js --network polygonMainnet` - Deploy Merkle version to mainnet
- `npx hardhat verify --network polygonMainnet <address> "<constructor-args>"` - Verify contracts

## Architecture

### Dual ZKP Systems
1. **IdentityZKP**: Simple hash-based verification
   - User submits identity hash → Admin approves → User proves knowledge via ZKP
   - Contract: `contracts/IdentityZKP.sol` + `contracts/IdentityVerifier.sol`
   - Circuit: `circuits/IdentityPossessionProof.circom`

2. **IdentityMerkleZKP**: Merkle tree batch verification  
   - Admin maintains Merkle tree of approved identities → Users prove inclusion + knowledge
   - Contract: `contracts/IdentityMerkleZKP.sol` + `contracts/IdentityMerkleVerifier.sol`
   - Circuit: `circuits/IdentityMerkleProof.circom` (16 levels, supports 65,536 identities)

### Key Directories
- `circuits/` - Circom circuit definitions using Poseidon hashing
- `contracts/` - Solidity contracts (main logic + Groth16 verifiers)
- `scripts/` - Circuit compilation, proof generation, and verification utilities
- `test/` - Contract tests and gas benchmarking
- `build/` - Generated circuit artifacts (auto-created)
- `ignition/modules/` - Hardhat Ignition deployment modules

### Circuit Flow
Both circuits use identical identity hashing: `Poseidon(nik, nama, ttl, key)` where:
- `nik`: National Identity Number (numeric)
- `nama`: Name (hashed to numeric representation)  
- `ttl`: Date of birth timestamp
- `key`: User secret key

Merkle circuit additionally proves inclusion in approved identity tree with salt and status fields.

### Dependencies
- Global: `circom`, `snarkjs` (circuit compilation/proof generation)
- Required files: `pot12_final.ptau`, `pot15_final.ptau` (trusted setup)
- Key libraries: `circomlibjs`, `merkletreejs`, `ethers`, `@openzeppelin/contracts`

## Development Notes

### Testing Strategy
- Use existing proof files in `build/` directory for tests
- Generate test proofs with appropriate scripts before running contract tests
- Gas comparison tests available in `test/gasComparison.js` and `test/benchmark.js`

### Network Configuration
- Testnet: Polygon Amoy (`polygonAmoy` network)
- Mainnet: Polygon (`polygonMainnet` network)
- Environment variables: `PRIVATE_KEY`, `POLYGON_AMOY_RPC`, `POLYGON_MAINNET_RPC`, `POLYGONSCAN_API_KEY`

### Proof Generation Workflow
1. Setup: `npm run zkp:setup` (compile + trusted setup)
2. Input: `npm run zkp:input` (generate test identity data)
3. Proof: `npm run zkp:proof` (create ZKP proof)
4. Verify: `npm run zkp:verify` (local verification)
5. Deploy & test contracts with generated proofs
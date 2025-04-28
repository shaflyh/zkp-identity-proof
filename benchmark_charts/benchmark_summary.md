# ZKP IDENTITY CONTRACT BENCHMARK SUMMARY
Contract Address: 0xF99024c6E16c2dCCA305DAF4406b17D93F22a72f
Test Date: 4/28/2025, 12:21:21 PM

## Gas Costs
- submitHashByUser: 28,939 gas
- approveIdentity: 52,419 gas
- submitProof: 250,356 gas
- revokeApprovedIdentity: 29,290 gas

## Transaction Times
- submitHashByUser: 8020.00 ms
- approveIdentity: 8147.00 ms
- submitProof: 8394.00 ms
- revokeApprovedIdentity: 10628.00 ms

## Concurrency Results
- Level 3: 0.1178 tx/s

## Recommendations
1. Most expensive operation is 'submitProof' at 250356 gas
2. Consider implementing batched proofs if possible to reduce gas costs when submitting multiple proofs
3. Monitor network congestion and gas prices to perform identity operations during lower-cost periods
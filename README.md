# harhdat-safe-contract-upgrader

Simple hardhat task to update a contract through a Safe transaction. The task simply deploy the new implementation contract and then sends to the Safe relay the signature of the transaction that updates the proxy address.


&nbsp;

***

&nbsp;

## :heavy_plus_sign: How to install it

```
npm install harhdat-safe-contract-upgrader --save-dev
```

&nbsp;

***

&nbsp;

## :rocket: How to use it

```
Usage: hardhat [GLOBAL OPTIONS] propose-upgrade [--base-gas <INT>] --factory <STRING> [--gas-price <INT>] [--origin <STRING>] --proxy <STRING> --safe <STRING> [--safe-tx-gas <INT>] [--tx-service-url <STRING>]

OPTIONS:

  --base-gas            The base gas (default: 1000000)
  --factory             The name of the factory contract that will be used as new implementation 
  --gas-price           The gas price (default: 0)
  --origin              The origin (default: "hardhat-safe-contract-upgrader")
  --proxy               The proxy contract address to upgrade 
  --safe                The Safe address 
  --safe-tx-gas         The Safe transaction gas (default: 1000000)
  --tx-service-url      The Safe Transaction Service API endpoint (default: "https://safe-transaction-mainnet.safe.global")

propose-upgrade: Propose a Safe transaction to upgrade a contract
```
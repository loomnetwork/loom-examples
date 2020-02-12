# Loom Examples

This repository holds a few example projects:

* Universal signing demo
* Deposit and withdraw ETH between Ethereum and Basechain
* Deposit and withdraw ERC20 tokens between Ethereum and Basechain
* Deposit and withdraw TRX between Tron and Basechain
* Deposit and withdraw BNB tokens between Binance chain and Basechain
* Deposit and withdraw BEP2 tokens between Binance chain and Basechain
* Move tokens between Binance chain, Basechain, and Ethereum

##  Universal signing demo

### Install

```bash
npm install
```

### Deploy to Extdev

First, let's generate your Loom private key by running:

```bash
npm run gen:loom-key
```

Then, we can migrate the the `SimpleStore` smart contract:

```bash
npm run migrate:loom
```

### Start the webserver

```bash
npm run start
```

Open [http://localhost:8080/](http://localhost:8080/) in your favorite browser.

## Deposit and withdraw ETH between Ethereum and Basechain

### Install

```bash
npm install
```

### Start the webserver

```bash
npm run start
```

Open [http://localhost:8080/](http://localhost:8080/) in your favorite browser.


## Deposit and withdraw ERC20 tokens between Ethereum and Basechain

### Install

```bash
npm install
```

### Generate Loom private key

```bash
npm run gen:loom-key
```

### Generate Rinkeby private key

```bash
npm run gen:rinkeby-key
```

### Deploy to Loom

```bash
npm run migrate:loom
```

### Set Infura API KEY

```bash
export INFURA_API_KEY=YOUR INFURA API KEY
```

### Deploy to Rinkeby

First, get yourself some Ethers to pay for the deployment. Head over to [this page](https://faucet.rinkeby.io/) and follow the instructions.

Next, just run:

```
npm run migrate:rinkeby
```

This will give all tokens to the address that created the contract. So, you either import this account in Metamask or transfer the newly minted tokens to your account.

### Map Contracts

```bash
npm run map:contracts
```

### Start the webserver

```bash
npm run start
```

Open [http://localhost:8080/](http://localhost:8080/) in your favorite browser.

## Deposit and withdraw TRX between Tron and Basechain

See the [Deposit and Withdraw TRX](https://loomx.io/developers/en/deposit-and-withdraw-trx.html) page for more details

## Deposit and withdraw BNB tokens between Binance chain and Basechain

See the [Deposit and Withdraw BNB](https://loomx.io/developers/en/deposit-and-withdraw-bnb.html) page for more details.

## Deposit and withdraw BEP2 tokens between Binance chain and Basechain

See the [Deposit and Withdraw BEP2](https://loomx.io/developers/en/deposit-and-withdraw-bep2.html) page for instructions on how to run this demo.

## Move Tokens between Binance, Loom, and Ethereum

See the [Move Tokens between Binance, Loom, and Ethereum](https://loomx.io/developers/en/binance-loom-ethereum.html) page for instructions on how to run this demo.

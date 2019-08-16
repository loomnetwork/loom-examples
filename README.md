# Loom Examples

This repository holds a few example projects.

##  Universal Signing Demos

The simple universal signing demos show how Loom universal signing works.

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

### Start the web server

```bash
npm run start
```

Open [http://localhost:8080/](http://localhost:8080/) in your favorite browser.


## ERC20 Demo

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


### Start the web server

```bash
npm run start
```

Open [http://localhost:8080/](http://localhost:8080/) in your favorite browser.


## BNB Demo

Follow the instruction from the [Deposit and Withdraw BNB](https://loomx.io/developers/en/deposit-and-withdraw-bnb.html) page.


## BEP2 Demo

See the [Deposit and Withdraw BEP2](https://loomx.io/developers/en/deposit-and-withdraw-bep2.html) page for instructions on how to run this demo.


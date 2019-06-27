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

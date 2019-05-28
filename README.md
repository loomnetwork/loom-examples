

## Simple Eth Signing Demo

This simple demo project shows how Loom universal signing works.

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
npm run migrate
```

### Start the web server

```bash
npm run start
```

Open [http://localhost:8080/](http://localhost:8080/) in your favorite browser.

/**
 * Usage:
 * `yarn add @binance-chain/javascript-sdk` or `npm i @binance-chain/javascript-sdk`
 * then
 * `node getPrivKeyFromKeystore.js <-keystore file path->`
 */

const { readFile, writeFileSync } = require("fs")
const sdk = require("@binance-chain/javascript-sdk")
const readline = require('readline')
if (process.argv.length <= 2) {
	console.log("Usage: " + __filename + " path/to/directory")
	process.exit(1);
}
let path = process.argv[2]
console.log(path)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.stdoutMuted = true

const getPassword = new Promise(function(resolve, reject) {
  rl.question('Password: ', function (password) {
    rl.close();
    resolve(password)
  })

  rl._writeToOutput = function _writeToOutput(stringToWrite) {
    if (rl.stdoutMuted)
      rl.output.write("*")
    else
      rl.output.write(stringToWrite)
  };
});

getPassword.then((password) => {
  readFile(path, "utf-8", (err, keyData) => {
    const keyStore = JSON.parse(keyData)
    const privateKey = sdk.crypto.getPrivateKeyFromKeyStore(keyStore, password)
    writeFileSync("./binance/private-key.txt", privateKey)
    console.log("\nExported private key to private-key.txt")
  })
})

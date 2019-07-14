// Import here Polyfills if needed. Recommended core-js (npm i -D core-js)
// import "core-js/fn/array.find"
// ...
const bip39 = require(`bip39`)
const bip32 = require(`bip32`)
const bech32 = require(`bech32`)
const secp256k1 = require(`secp256k1`)
const sha256 = require("crypto-js/sha256")
const ripemd160 = require("crypto-js/ripemd160")
const CryptoJS = require("crypto-js")
var DICKS = "DIKS"
const hdPathAtom = `m/44'/118'/0'/0/0` // key controlling ATOM allocation

const standardRandomBytesFunc = (x) => CryptoJS.lib.WordArray.random(x).toString()
exports.providers = {}

//TODO: Set new prefixes for other Tendermint prefixes

exports.setHTTPProvider = (http_provider) => {
  exports.providers = {http: http_provider} // For extensions requiring nodes
  return 0;
}

exports.generateWalletFromSeed = (mnemonic) => {
  const masterKey = deriveMasterKey(mnemonic)
  const { privateKey, publicKey } = deriveKeypair(masterKey)
  const cosmosAddress = createCosmosAddress(publicKey)
  return {
    privateKey: privateKey.toString(`hex`),
    publicKey: publicKey.toString(`hex`),
    cosmosAddress
  }
}

exports.generateSeed = (randomBytesFunc = standardRandomBytesFunc) => {
  const randomBytes = Buffer.from(randomBytesFunc(32), `hex`)
  if (randomBytes.length !== 32) throw Error(`Entropy has incorrect length`)
  const mnemonic = bip39.entropyToMnemonic(randomBytes.toString(`hex`))

  return mnemonic
}

exports.generateWallet = (randomBytesFunc = standardRandomBytesFunc) => {
  const mnemonic = generateSeed(randomBytesFunc)
  return generateWalletFromSeed(mnemonic)
}

// NOTE: this only works with a compressed public key (33 bytes)
const createCosmosAddress = (publicKey) => {
  const message = CryptoJS.enc.Hex.parse(publicKey.toString(`hex`))
  const hash = ripemd160(sha256(message)).toString()
  const address = Buffer.from(hash, `hex`)
  const cosmosAddress = bech32ify(address, `cosmos`)

  return cosmosAddress
}

const deriveMasterKey = (mnemonic) => {
  // throws if mnemonic is invalid
  // NOTE: Dont put fucking invalid mnemonics
  bip39.validateMnemonic(mnemonic)

  const seed = bip39.mnemonicToSeed(mnemonic)
  const masterKey = bip32.fromSeed(seed)
  return masterKey
}

const deriveKeypair = (masterKey) => {
  const cosmosHD = masterKey.derivePath(hdPathAtom)
  const privateKey = cosmosHD.privateKey
  const publicKey = secp256k1.publicKeyCreate(privateKey, true)

  return {
    privateKey,
    publicKey
  }
}

const bech32ify = (address, prefix) => {
  const words = bech32.toWords(address)
  return bech32.encode(prefix, words)
}

// Transactions often have amino decoded objects in them {type, value}.
// We need to strip this clutter as we need to sign only the values.
const prepareSignBytes = (jsonTx) => {
  if (Array.isArray(jsonTx)){
    return jsonTx.map(prepareSignBytes)
  }

  // string or number
  if (typeof jsonTx !== `object`) {
    return jsonTx
  }

  let sorted = {}
  Object.keys(jsonTx)
    .sort()
    .forEach(key => {
      if (jsonTx[key] === undefined || jsonTx[key] === null) return

      sorted[key] = prepareSignBytes(jsonTx[key])
    })
  return sorted
}

/*
The SDK expects a certain message format to serialize and then sign.

type StdSignMsg struct {
  ChainID       string      `json:"chain_id"`
  AccountNumber uint64      `json:"account_number"`
  Sequence      uint64      `json:"sequence"`
  Fee           auth.StdFee `json:"fee"`
  Msgs          []sdk.Msg   `json:"msgs"`
  Memo          string      `json:"memo"`
}
*/
const createSignMessage = (
  jsonTx,
  txInfo //{ sequence, account_number, chain_id }
) => {
  // sign bytes need amount to be an array
  const fee = {
    amount: jsonTx.fee.amount || [],
    gas: jsonTx.fee.gas
  }

  return JSON.stringify(
    prepareSignBytes({
      fee,
      memo: jsonTx.memo,
      msgs: jsonTx.msg, // weird msg vs. msgs
      sequence: txInfo.sequence,
      account_number: txInfo.account_number,
      chain_id: txInfo.chain_id
    })
  )
}

// produces the signature for a message (returns Buffer)
exports.signWithPrivateKey = (signMessage, privateKey) => {
  const signHash = Buffer.from(sha256(signMessage).toString(), `hex`)
  const { signature } = secp256k1.sign(signHash, Buffer.from(privateKey, `hex`))
  return signature
}

exports.createSignature = (
  signature,
  publicKey
) => {
  return {
    signature: signature.toString(`base64`),
    pub_key: {
      type: `tendermint/PubKeySecp256k1`, // TODO: allow other keytypes
      value: publicKey.toString(`base64`)
    }
  }
}

// main function to sign a jsonTx using the local keystore wallet
// returns the complete signature object to add to the tx
exports.sign = (jsonTx, wallet, requestMetaData) => {
  const signMessage = createSignMessage(jsonTx, requestMetaData)
  const signatureBuffer = signWithPrivateKey(signMessage, wallet.privateKey)
  const pubKeyBuffer = Buffer.from(wallet.publicKey, `hex`)
  return createSignature(
    signatureBuffer,
    pubKeyBuffer
  )
}

// adds the signature object to the tx
exports.createSignedTx = (tx, signature) => {
  return Object.assign({}, tx, {
    signatures: [signature]
  })
}

// the broadcast body consists of the signed tx and a return type
exports.createBroadcastBody = (signedTx) => {
  return JSON.stringify({
    tx: signedTx,
    return: `block`
  })
}

exports.broadcastTransaction = ()=>{

}

const webAtom = exports;

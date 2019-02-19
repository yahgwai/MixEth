let EC = require("elliptic").ec;
let ec = new EC("secp256k1");
let BN = require("bn.js");
let secureRandom = require("secure-random");
let Web3 = require("web3");
let web3 = new Web3();

let n = "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141";

//FIXME: checks has to be added for sign and verify as well

//this is a modified ECDSA, where user can specifiy their own generator element
function sign(generator, privKey, msgHash) {
    let mHash = new BN(msgHash, 16);
    let pKey = new BN(privKey, 16);

    /*
    we assume to use keccak-256, so there is no need to take the 256 leftmost bits,
    since messages are already truncated to 256-bits via keccak-256
  */

    /*
    Select a cryptographically secure random integer k from [1,n-1]
  */
    let k = new BN(secureRandom.randomBuffer(32).toString("hex"), 16).mod(ec.curve.n);

    //Calculate the curve point (x_{1},y_{1})=kG.

    let G = ec.keyFromPublic(generator, "hex").getPublic();
    let kG = G.mul(k);

    let pubKey = G.mul(pKey);
    console.log("Public key: ", pubKey);

    //get the x coordinate of kG mod n
    let r = kG.getX().mod(ec.curve.n);

    // Calculate  s=k^{-1}(mHash+r*pKey)\,mod n.
    let kinv = k.invm(ec.curve.n);
    let term = mHash.add(r.mul(pKey)).mod(ec.curve.n);
    let s = kinv.mul(term).mod(ec.curve.n);

    return { r: r, s: s, pubKey: pubKey };
}

function multiplyPriv(_privKey, _accumulatedConstant) {
    let accumulatedConstant = ec.keyFromPublic(_accumulatedConstant, "hex").getPublic();
    let privKey = new BN(_privKey, 16);
    let newPublic = accumulatedConstant.mul(privKey);
    return newPublic;
}

function verify(generator, _pubKey, msgHash, _r, _s) {
    let G = ec.keyFromPublic(generator, "hex").getPublic();
    let pubKey = ec.keyFromPublic(_pubKey, "hex").getPublic();
    let mHash = new BN(msgHash, 16);
    let r = new BN(_r, 16);
    let s = new BN(_s, 16);
    //Calculate w=s^{-1} mod n.
    let w = s.invm(ec.curve.n);
    //Calculate u1=zw mod n and u2=rw mod n
    let u1 = mHash.mul(w).mod(ec.curve.n);
    let u2 = r.mul(w).mod(ec.curve.n);

    console.log("w", w);
    console.log("u1", u1);
    console.log("u2", u2);
    //Calculate the curve point (x,y)=u1*G+u2*pubKey.
    let Q = G.mul(u1).add(pubKey.mul(u2));
    let u1Gx = G.mul(u1).getX();
    let u1Gy = G.mul(u1).getY();
    let u2pKx = pubKey.mul(u2).getX();
    let u2pKy = pubKey.mul(u2).getY();
    console.log("u1Gx", u1Gx);
    console.log("u1Gy", u1Gy);
    console.log("u2pKx", u2pKx);
    console.log("u2pKy", u2pKy);
    //The signature is valid if r=x mod n, invalid otherwisee

    let outputArray = [
        "0x" +
            G.getX()
                .toString(16)
                .padStart(64, "0"),
        "0x" +
            G.getY()
                .toString(16)
                .padStart(64, "0"),
        "0x" +
            pubKey
                .getX()
                .toString(16)
                .padStart(64, "0"),
        "0x" +
            pubKey
                .getY()
                .toString(16)
                .padStart(64, "0"),
        "0x" + msgHash.padStart(64, "0"),
        "0x" + r.toString(16).padStart(64, "0"),
        "0x" + s.toString(16).padStart(64, "0"),
        "0x" + u1Gx.toString(16).padStart(64, "0"),
        "0x" + u1Gy.toString(16).padStart(64, "0"),
        "0x" + u2pKx.toString(16).padStart(64, "0"),
        "0x" + u2pKy.toString(16).padStart(64, "0"),
        "0x" + w.toString(16).padStart(64, "0")
    ];
    console.log("[" + outputArray.map(o => '"' + o + '"') + "]");

    return Q.getX()
        .mod(ec.curve.n)
        .eq(r);
}

function calculateEthereumAddress(privKey) {
    let key = ec.keyFromPrivate(privKey);
    let pubKey =
        "0x" +
        key
            .getPublic()
            .getX()
            .toString("hex")
            .padStart(64, "0") +
        key
            .getPublic()
            .getY()
            .toString("hex")
            .padStart(64, "0");
    let hashedpubKey = web3.utils.keccak256(pubKey);
    return "0x" + hashedpubKey.slice(26);
}

function messageHash(sender, x, y) {
    sender = web3.utils.toChecksumAddress(sender);
    x = new BN(x, 16);
    y = new BN(y, 16);

    return web3.utils.soliditySha3({ t: "address", v: sender }, { t: "uint256", v: x }, { t: "uint256", v: y });
}

function signAndVerify(generator, privKey, senderAddress) {
    // create sum dummys for signing
    let pub = multiplyPriv(privKey, generator);
    let pubKeyX = pub
        .getX()
        .toString(16)
        .padStart(64, "0");
    let pubKeyY = pub
        .getY()
        .toString(16)
        .padStart(64, "0");
    let msgHash = messageHash("0x" + senderAddress, pubKeyX, pubKeyY);
    msgHash = msgHash.substring(2);
    let { r, s } = sign(generator, privKey, msgHash);
    console.log(generator,
        "04" + pubKeyX + pubKeyY,
        msgHash,
        r.toString(16).padStart(64, "0"),
        s.toString(16).padStart(64, "0"));
    return verify(
        generator,
        "04" + pubKeyX + pubKeyY,
        msgHash,
        r.toString(16).padStart(64, "0"),
        s.toString(16).padStart(64, "0")
    );
}

module.exports = {
    sign: sign,
    multiplyPriv: multiplyPriv,
    verify: verify,
    signAndVerify: signAndVerify,
    calculateEthereumAddress: calculateEthereumAddress,
    messageHash: messageHash
};
require("make-runnable");

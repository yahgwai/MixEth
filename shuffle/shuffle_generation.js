const { randomBytes } = require("crypto");
const sjcl = require("sjcl");
var EC = require("elliptic").ec;
var ec = new EC("secp256k1");
let G =
    "0479BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8"; //Generator point

function formatArray(arr) {
    let face = '["' + arr.reduce((a, b) => a + '","' + b + "") + '"]';
    if (face === "[[]]") return "[]";
    else return face;
}

function shuffleGenerator(tokenAddress, prevShuffle, pubKeys, prevCumulatedConstant) {
    let pubKeyArray = pubKeys.split(",");
    let prevShuffleArray = prevShuffle.split(",").map(p => "0x" + p);

    let shufflingConstant = randomBytes(32);
    console.log("Shuffling constant: ", shufflingConstant.toString("hex"));
    let shuffledPubKeys = [];
    let prevCumulatedC = ec.keyFromPublic(prevCumulatedConstant, "hex").getPublic();
    currentCumulatedC = prevCumulatedC.mul(shufflingConstant);
    let cG = ec
        .keyFromPublic(G, "hex")
        .getPublic()
        .mul(shufflingConstant);
    console.log("cG", cG);

    let shuffledKey;
    for (var i = 0; i < pubKeyArray.length; i++) {
        console.log("figyuka", pubKeyArray[i].toString("hex"));
        let pub = ec.keyFromPublic("04" + pubKeyArray[i].toString("hex").padStart(64, "0"), "hex").getPublic();
        console.log("pub", pub);
        if (i === pubKeyArray.length - 1) shuffledKey = pub.mul(shufflingConstant);
        shuffledPubKeys.push(pub.mul(shufflingConstant));
    }
    shuffledArray = shuffle(shuffledPubKeys);

    // format cumulated constant
    let accumulatedConstantString =
        '["0x' +
        currentCumulatedC
            .getX()
            .toString(16)
            .padStart(64, "0") +
        '","0x' +
        currentCumulatedC
            .getY()
            .toString(16)
            .padStart(64, "0") +
        '"]';

    let shuffleOutputString =
        "[" +
        shuffledArray.map(
            s =>
                '"0x' +
                s
                    .getX()
                    .toString(16)
                    .padStart(64, "0") +
                '","0x' +
                s
                    .getY()
                    .toString(16)
                    .padStart(64, "0") +
                '"'
        ) +
        "]";

    let formatInputString =
        "0x" + tokenAddress.toString(16).padStart(40, "0") +
        "," +
        formatArray(prevShuffleArray) +
        "," +
        shuffleOutputString +
        "," +
        accumulatedConstantString;

    return {
        shuffledPubkeys: shuffledArray,
        cG: cG,
        accumulatedConstantString: accumulatedConstantString,
        shuffledOutputString: shuffleOutputString,
        currentCumulatedConstant: currentCumulatedC,
        accumulatedConstantPubKey:
            "04" +
            currentCumulatedC
                .getX()
                .toString(16)
                .padStart(64, "0") +
            currentCumulatedC
                .getY()
                .toString(16)
                .padStart(64, "0"),
        shuffleOutput: shuffledArray
            .map(a => [
                a
                    .getX()
                    .toString(16)
                    .padStart(64, "0"),
                a
                    .getY()
                    .toString(16)
                    .padStart(64, "0")
            ])
            .reduce((a, b) => a + "," + b),
        shuffledKey:
            "04" +
            shuffledKey
                .getX()
                .toString(16)
                .padStart(64, "0") +
            shuffledKey
                .getY()
                .toString(16)
                .padStart(64, "0"),
        inputString: formatInputString
    };
}

function shuffleGeneratorWithRandKeys(prevCumulatedConstant) {
    let shufflingConstant = randomBytes(32);
    console.log("Shuffling constant: ", shufflingConstant.toString("hex").padStart(64, "0"));
    let shuffledPubKeys = [];

    let prevCumulatedC = ec.keyFromPublic(prevCumulatedConstant, "hex").getPublic();
    currentCumulatedC = prevCumulatedC.mul(shufflingConstant);
    let cG = ec
        .keyFromPublic(G, "hex")
        .getPublic()
        .mul(shufflingConstant);

    let pubKeys = generatePubKeys(6);
    for (var i = 0; i < pubKeys.length; i++) {
        let pub = pubKeys[i].getPublic();
        console.log(i + ": " + JSON.stringify(pub.mul(shufflingConstant)));
        shuffledPubKeys.push(pub.mul(shufflingConstant));
    }
    shuffledArray = shuffle(shuffledPubKeys);

    return { shuffledPubkeys: shuffledArray, cG: cG, currentCumulatedConstant: currentCumulatedC };
}
//Implementation of the Fischer-Yates-Knuth-Shuffle
function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue,
        randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex); //needs to be replaced by cryptographically secure PRNG
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
//generates i public keys for testing purposes
function generatePubKeys(i) {
    let publicKeys = [];
    for (var j = 0; j < i; j++) {
        let keyPair = ec.genKeyPair();
        let pubPoint = keyPair.getPublic();
        console.log("Privkey: ", keyPair.getPrivate());
        pubKeyX = pubPoint.getX().toString("hex");
        pubKeyY = pubPoint.getY().toString("hex");
        let pub = ec.keyFromPublic("04" + pubKeyX + pubKeyY, "hex");
        publicKeys.push(pub);
    }
    return publicKeys;
}

module.exports = { shuffleGenerator: shuffleGenerator, shuffleGeneratorWithRandKeys: shuffleGeneratorWithRandKeys };
require("make-runnable");

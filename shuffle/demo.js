var EC = require("elliptic").ec;
var ec = new EC("secp256k1");
let Web3 = require("web3");
const nodeUrl = "https://rinkeby.infura.io/v3/fd21f79874f74ed19e0b9f47f03446a3";
let web3 = new Web3(new Web3.providers.HttpProvider(nodeUrl));
let BN = require("bignumber.js");
let { shuffleGenerator } = require("./shuffle_generation");
let { multiplyPriv } = require("./../ecdsa/sign");
let parentLibJson = require("./../build/contracts/ParentLib.json")
let mixEthJson = require("./../build/contracts/MixEthDemo.json")

function pubKey(privKey) {
    let key = ec.keyFromPrivate(privKey);
    let public = key.getPublic();

    return {
        x: public.getX(),
        y: public.getY()
    };
}

function pubKeys(privKeys) {
    return [privKeys.split(",").map(p => pubKey(p))];
}

function messageHash(sender, x, y) {
    sender = web3.utils.toChecksumAddress(sender);
    x = new BN(x, 16);
    y = new BN(y, 16);

    return web3.utils.soliditySha3({ t: "address", v: sender }, { t: "uint256", v: x }, { t: "uint256", v: y });
}

// setup a demo environment with the correct keys

const parentLibBytecode = parentLibJson.bytecode;
const parentLibAbi = parentLibJson.abi;
const mixEthBytecode = mixEthJson.bytecode;
const mixEthAbi = mixEthJson.abi;

var HDWalletProvider = require("truffle-hdwallet-provider");

var privKeys = ["446ADFBDD521997C8F3010F488EFC919073D6ED0C02831E350C010EE22187FFC"];

const config = {
    gasPrice: 15000000000,
    depositValue: 100000000000000000,
    rinkeby: {
        url: nodeUrl,
        setupPrivKey: "446ADFBDD521997C8F3010F488EFC919073D6ED0C02831E350C010EE22187FFC",
        kKey1: [
            "4bfe3f5ae062531c8c46fa441c43fc24c817301207730cd87d07cd79f969d608",
            "16aed91c7f91c83bb8e2cede908459c1e047b7f1ca690897cbb4a6f4e7911ae6"
        ],
        kKey2: [
            "17236bd208c9bb28017c6587183cbea085635367c43f53bc07d4a146a9614b89",
            "b19f3d1c73ecf3b87084dc510f2061ccccbdae7c7791331ed8e1a32c4a665576"
        ],
        receiverShuffleKey: "2ac6c190b09897cd8987869cc7b918cfea07ee82038d492abce033c75c1b1d0c",
        blockGasLimit: 7000000
        
    },
    local: {
        url: "http://localhost:8545",
        setupPrivKey: "f90ffad0fab4461603284f3afb95520b5a035aa73a8af73575ea1565e8072e1b",
        kKey1: [
            "4bfe3f5ae062531c8c46fa441c43fc24c817301207730cd87d07cd79f969d608",
            "16aed91c7f91c83bb8e2cede908459c1e047b7f1ca690897cbb4a6f4e7911ae6"
        ],
        kKey2: [
            "17236bd208c9bb28017c6587183cbea085635367c43f53bc07d4a146a9614b89",
            "b19f3d1c73ecf3b87084dc510f2061ccccbdae7c7791331ed8e1a32c4a665576"
        ],
        receiverShuffleKey: "2ac6c190b09897cd8987869cc7b918cfea07ee82038d492abce033c75c1b1d0c",
        blockGasLimit: 5000000
    }
};

async function setup(network) {
    const setupConfig = network === "rinkeby" ? config.rinkeby : config.local
    const walletProvider = new HDWalletProvider([setupConfig.setupPrivKey], setupConfig.url);
    web3 = new Web3(walletProvider);
    let accounts = await web3.eth.getAccounts();
    const setup = accounts[0];
    const nextMixPriv = setupConfig.receiverShuffleKey;

    const mixParty1 = setupConfig.kKey1;
    const mixParty2 = setupConfig.kKey2;
    const depositValue = config.depositValue;

    // deploy a parent lib

    console.log("deploying parent lib");
    let parentLibContractPreDeploy = new web3.eth.Contract(parentLibAbi);
    let parentLibContract = await parentLibContractPreDeploy
        .deploy({
            data: parentLibBytecode
        })
        .send({
            from: setup,
            gas: 4000000,
            gasPrice: config.gasPrice
        });

    // deploy mixeth
    console.log("deploying mix eth");
    let mixEthContractPreDeploy = new web3.eth.Contract(mixEthAbi);
    let mixEthContract = await mixEthContractPreDeploy
        .deploy({
            data: mixEthBytecode,
            arguments: [parentLibContract.options.address]
        })
        .send({
            from: setup,
            gas: setupConfig.blockGasLimit,
            gasPrice: config.gasPrice
        });
    console.log("mix eth deployed at ", mixEthContract.options.address);

    // now deposit some ether for participants 1 and 2
    console.log("deposit 1");
    let deposit1 = await mixEthContract.methods
        .depositEther("0x" + mixParty1[0], "0x" + mixParty1[1])
        .send({ from: setup, value: depositValue, gas: 3000000, gasPrice: config.gasPrice });
    console.log("deposit 2");
    let deposit2 = await mixEthContract.methods
        .depositEther("0x" + mixParty2[0], "0x" + mixParty2[1])
        .send({ from: setup, value: depositValue, gas: 3000000, gasPrice: config.gasPrice });

    // now upload a single shuffle
    // TODO: commit value for this shuffle!
    let shuffle = shuffleGenerator(
        "0x0000000000000000000000000000000000000000",
        "",
        mixParty1[0] + mixParty1[1] + "," + mixParty2[0] + mixParty2[1],
        "0479BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8"
    );

    console.log("uploading shuffle");
    // console.log(await mixEthContract.methods.Shuffles("0x0000000000000000000000000000000000000000", false).call())
    // console.log(await mixEthContract.methods.Shuffles("0x0000000000000000000000000000000000000000", true).call())

    let shuffleUpload = await mixEthContract.methods
        .uploadShuffle(
            "0x0000000000000000000000000000000000000000",
            [],
            shuffle.shuffleOutput.split(",").map(a => "0x" + a),
            [
                "0x" +
                    shuffle.currentCumulatedConstant
                        .getX()
                        .toString(16)
                        .padStart(64, "0"),
                "0x" +
                    shuffle.currentCumulatedConstant
                        .getY()
                        .toString(16)
                        .padStart(64, "0")
            ]
        )
        .send({ from: setup, gas: 3000000, gasPrice:config.gasPrice, value: depositValue });

    // console.log(await mixEthContract.methods.Shuffles("0x0000000000000000000000000000000000000000", false).call())
    // console.log(await mixEthContract.methods.Shuffles("0x0000000000000000000000000000000000000000", true).call())

    let nextMixPublic = multiplyPriv(nextMixPriv, shuffle.accumulatedConstantPubKey);
    let unmixed = ec.keyFromPrivate(nextMixPriv).getPublic();

    return {
        mixEth: mixEthContract.options.address,
        previousShuffle: shuffle.shuffleOutput,
        previousShuffleConstant: shuffle.accumulatedConstantPubKey,
        mixedKey: [
            nextMixPublic
                .getX()
                .toString(16)
                .padStart(64, "0"),
            nextMixPublic
                .getY()
                .toString(16)
                .padStart(64, "0")
        ],
        // unmixedKey: [
        //     unmixed
        //         .getX()
        //         .toString(16)
        //         .padStart(64, "0"),
        //     unmixed
        //         .getY()
        //         .toString(16)
        //         .padStart(64, "0")
        // ]
    };
}

module.exports = { pubKey: pubKey, pubKeys: pubKeys, messageHash: messageHash, setup: setup };
require("make-runnable");

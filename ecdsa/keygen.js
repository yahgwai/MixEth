let EC = require('elliptic').ec;
let ec = new EC('secp256k1');

let key = ec.keyFromPrivate("446adfbdd521997c8f3010f488efc919073d6ed0c02831e350c010ee22187ffc")
let public  = key.getPublic();

console.log(public.encode("hex"));
console.log(public.getX());
console.log(public.getY());
import { ethers } from "hardhat";

async function main() {

  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    deployer.address
  );
  
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Cryptolympians = await ethers.getContractFactory("Cryptolympians");
  const cryptolympians = await Cryptolympians.deploy();

  console.log("Contract address:", cryptolympians.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
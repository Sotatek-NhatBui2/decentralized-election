import { ethers, upgrades } from "hardhat";

async function main() {
  const VOTING_TOKEN_NAME = "Voting Token";
  const VOTING_TOKEN_SYMBOL = "VOTE";
  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1 million tokens
  const REQUIRED_TOKEN_BALANCE = ethers.parseEther("1"); // 1 token required to vote

  // Deploy VotingToken first
  const VotingToken = await ethers.getContractFactory("VotingToken");
  const votingToken = await VotingToken.deploy(
    VOTING_TOKEN_NAME,
    VOTING_TOKEN_SYMBOL,
    INITIAL_SUPPLY
  );
  await votingToken.waitForDeployment();

  console.log("VotingToken deployed to:", await votingToken.getAddress());

  // Deploy Election as upgradeable
  const Election = await ethers.getContractFactory("Election");
  const election = await upgrades.deployProxy(
    Election,
    [await votingToken.getAddress(), REQUIRED_TOKEN_BALANCE],
    { initializer: "initialize" }
  );
  await election.waitForDeployment();

  console.log("Election deployed to:", await election.getAddress());

  // Verify implementation
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    await election.getAddress()
  );
  console.log("Election implementation deployed to:", implementationAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

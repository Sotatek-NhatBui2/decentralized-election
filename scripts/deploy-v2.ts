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
  const votingTokenAddress = await votingToken.getAddress();

  console.log("VotingToken deployed to:", votingTokenAddress);

  // Deploy VestingContract
  const VestingContract = await ethers.getContractFactory("VestingContract");
  const vestingContract = await VestingContract.deploy(votingTokenAddress);
  await vestingContract.waitForDeployment();
  const vestingContractAddress = await vestingContract.getAddress();

  console.log("VestingContract deployed to:", vestingContractAddress);

  // Deploy Election as upgradeable
  const Election = await ethers.getContractFactory("Election");
  const election = await upgrades.deployProxy(
    Election,
    [votingTokenAddress, REQUIRED_TOKEN_BALANCE, vestingContractAddress],
    { initializer: "initialize" }
  );
  await election.waitForDeployment();
  const electionAddress = await election.getAddress();

  console.log("Election deployed to:", electionAddress);

  // Verify implementation
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    await election.getAddress()
  );
  console.log("Election implementation deployed to:", implementationAddress);

  // Transfer ownership of VestingContract to Election contract
  await vestingContract.transferOwnership(await election.getAddress());
  console.log("VestingContract ownership transferred to Election contract");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

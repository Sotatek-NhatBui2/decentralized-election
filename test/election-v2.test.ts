import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

function getTimestamp(date: Date) {
  return Math.round(date.getTime() / 1000);
}

describe("Election V2", async function () {
  // Get signers
  const [owner, candidate1, candidate2, voter1, voter2] =
    await ethers.getSigners();

  // Constants for deployment
  const VOTING_TOKEN_NAME = "Voting Token";
  const VOTING_TOKEN_SYMBOL = "VOTE";
  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
  const REQUIRED_TOKEN_BALANCE = ethers.parseEther("1"); // 1 token
  const VESTING_AMOUNT = ethers.parseEther("1000"); // 1000 tokens for vesting
  const CANDIDATE_NAMES = ["Candidate 1", "Candidate 2"];
  const CANDIDATE_ADDRESSES = [candidate1.address, candidate2.address];

  // Fixture that deploys all contracts
  async function deployElectionFixture() {
    // Deploy VotingToken
    const VotingToken = await ethers.getContractFactory("VotingToken");
    const votingToken = await VotingToken.deploy(
      VOTING_TOKEN_NAME,
      VOTING_TOKEN_SYMBOL,
      INITIAL_SUPPLY
    );

    // Deploy VestingContract
    const VestingContract = await ethers.getContractFactory("VestingContract");
    const vestingContract = await VestingContract.deploy(
      await votingToken.getAddress()
    );

    // Deploy Election as upgradeable
    const Election = await ethers.getContractFactory("Election");
    const election = await upgrades.deployProxy(Election, [
      await votingToken.getAddress(),
      REQUIRED_TOKEN_BALANCE,
      await vestingContract.getAddress(),
    ]);

    // Transfer ownership of VestingContract to Election
    await vestingContract.transferOwnership(await election.getAddress());

    return { votingToken, vestingContract, election };
  }

  // Fixture that creates an election with single winner
  async function singleWinnerElectionFixture() {
    const { votingToken, vestingContract, election } = await loadFixture(
      deployElectionFixture
    );

    // Create election
    const startTime = getTimestamp(new Date()) + 3600; // 1 hour from now
    const endTime = startTime + 86400; // 24 hours from start
    await election.createElection(
      CANDIDATE_NAMES,
      CANDIDATE_ADDRESSES,
      startTime,
      endTime
    );

    // Transfer tokens to voters
    await votingToken.transfer(voter1.address, REQUIRED_TOKEN_BALANCE);
    await votingToken.transfer(voter2.address, REQUIRED_TOKEN_BALANCE);

    // Register voters
    await election.connect(voter1).registerVoter(1);
    await election.connect(voter2).registerVoter(1);

    // Move to start time
    await time.increaseTo(startTime);

    // Cast votes for candidate1
    await election.connect(voter1).castVote(1, 0);
    await election.connect(voter2).castVote(1, 0);

    // Move to end time and finalize
    await time.increaseTo(endTime + 1);
    await election.finalizeElection(1);

    // Transfer tokens to Election for vesting
    await votingToken.transfer(await election.getAddress(), VESTING_AMOUNT);

    return {
      votingToken,
      vestingContract,
      election,
      startTime,
      endTime,
      winner: candidate1,
      loser: candidate2,
    };
  }

  // Fixture that creates an election with tied winners
  async function tiedWinnersElectionFixture() {
    const { votingToken, vestingContract, election } = await loadFixture(
      deployElectionFixture
    );

    const startTime = getTimestamp(new Date()) + 3600;
    const endTime = startTime + 86400;
    await election.createElection(
      CANDIDATE_NAMES,
      CANDIDATE_ADDRESSES,
      startTime,
      endTime
    );

    // Setup voters
    await votingToken.transfer(voter1.address, REQUIRED_TOKEN_BALANCE);
    await votingToken.transfer(voter2.address, REQUIRED_TOKEN_BALANCE);
    await election.connect(voter1).registerVoter(1);
    await election.connect(voter2).registerVoter(1);

    await time.increaseTo(startTime);

    // Cast split votes
    await election.connect(voter1).castVote(1, 0);
    await election.connect(voter2).castVote(1, 1);

    await time.increaseTo(endTime + 1);
    await election.finalizeElection(1);

    // Transfer tokens for vesting
    await votingToken.transfer(await election.getAddress(), VESTING_AMOUNT);

    return {
      votingToken,
      vestingContract,
      election,
      startTime,
      endTime,
    };
  }

  describe("Vesting Schedule Creation", function () {
    it("should create vesting schedule for single winner", async function () {
      const { election, vestingContract, winner, loser } = await loadFixture(
        singleWinnerElectionFixture
      );

      await election.createVestingSchedule(1, VESTING_AMOUNT);

      const winnerVesting = await vestingContract
        .connect(winner)
        .getVestingScheduleData();
      const loserVesting = await vestingContract
        .connect(loser)
        .getVestingScheduleData();

      expect(winnerVesting.totalAmount).to.equal(VESTING_AMOUNT);
      expect(winnerVesting.claimedAmount).to.equal(0);
      expect(loserVesting.totalAmount).to.equal(0);
    });

    it("should split vesting schedule between tied winners", async function () {
      const { election, vestingContract } = await loadFixture(
        tiedWinnersElectionFixture
      );

      await election.createVestingSchedule(1, VESTING_AMOUNT);

      const vestingData1 = await vestingContract
        .connect(candidate1)
        .getVestingScheduleData();
      const vestingData2 = await vestingContract
        .connect(candidate2)
        .getVestingScheduleData();

      const expectedSplitAmount = VESTING_AMOUNT / 2n;
      expect(vestingData1.totalAmount).to.equal(expectedSplitAmount);
      expect(vestingData2.totalAmount).to.equal(expectedSplitAmount);
    });

    it("should fail if no votes were cast", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 3600;
      const endTime = startTime + 86400;

      await election.createElection(
        ["Candidate 1"],
        [candidate1.address],
        startTime,
        endTime
      );

      await time.increaseTo(endTime + 1);
      await election.finalizeElection(1);

      await expect(
        election.createVestingSchedule(1, VESTING_AMOUNT)
      ).to.be.revertedWith("No winner found");
    });

    it("should fail if election is not finalized", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 3600;
      const endTime = startTime + 86400;
      await election.createElection(
        ["Candidate 1"],
        [candidate1.address],
        startTime,
        endTime
      );

      await expect(
        election.createVestingSchedule(1, VESTING_AMOUNT)
      ).to.be.revertedWith("Election is not finalized");
    });

    it("should fail if vesting amount is zero", async function () {
      const { election } = await loadFixture(singleWinnerElectionFixture);

      await expect(election.createVestingSchedule(1, 0)).to.be.revertedWith(
        "Vesting amount must be greater than 0"
      );
    });
  });

  describe("Token Vesting", function () {
    it("should not allow claiming before first unlock", async function () {
      const { election, vestingContract, winner } = await loadFixture(
        singleWinnerElectionFixture
      );

      await election.createVestingSchedule(1, VESTING_AMOUNT);

      await expect(
        vestingContract.connect(winner).claimReward(VESTING_AMOUNT)
      ).to.be.revertedWith("Insufficient claimable amount");
    });

    it("should allow claiming after first unlock period", async function () {
      const { election, vestingContract, winner } = await loadFixture(
        singleWinnerElectionFixture
      );

      await election.createVestingSchedule(1, VESTING_AMOUNT);

      // Fast forward 30 days
      await time.increase(30 * 24 * 60 * 60);

      const expectedClaim = VESTING_AMOUNT / 20n; // 5% total amount
      await vestingContract.connect(winner).claimReward(expectedClaim);

      const vestingData = await vestingContract
        .connect(winner)
        .getVestingScheduleData();
      expect(vestingData.claimedAmount).to.equal(expectedClaim);
    });

    it("should show correct vesting schedule data", async function () {
      const { election, vestingContract, winner } = await loadFixture(
        singleWinnerElectionFixture
      );

      await election.createVestingSchedule(1, VESTING_AMOUNT);

      const vestingData = await vestingContract
        .connect(winner)
        .getVestingScheduleData();

      expect(vestingData.totalAmount).to.equal(VESTING_AMOUNT);
      expect(vestingData.unlockedAmount).to.equal(0);
      expect(vestingData.claimedAmount).to.equal(0);
    });
  });
});

// Because the decimal precision is 18, we can use ethers.parseEther to parse the amount

import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

function getTimestamp(date: Date) {
  return Math.round(date.getTime() / 1000);
}

describe("Election", async function () {
  // Get signers
  const [owner, acc1, acc2, acc3, acc4, acc5, acc6, acc7, acc8] =
    await ethers.getSigners();

  // Constants for deployment
  const VOTING_TOKEN_NAME = "Voting Token";
  const VOTING_TOKEN_SYMBOL = "VOTE";
  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1 million tokens
  const REQUIRED_TOKEN_BALANCE = ethers.parseEther("1"); // 1 token required to vote
  const CANDIDATE_ADDRESSES = [acc6.address, acc7.address, acc8.address];
  const CANDIDATE_NAMES = ["Candidate 6", "Candidate 7", "Candidate 8"]; // Add candidate names

  // Fixture that deploys both contracts
  async function deployElectionFixture() {
    // Deploy VotingToken
    const VotingToken = await ethers.getContractFactory("VotingToken");
    const votingToken = await VotingToken.deploy(
      VOTING_TOKEN_NAME,
      VOTING_TOKEN_SYMBOL,
      INITIAL_SUPPLY
    );

    // Deploy Election as upgradeable
    const Election = await ethers.getContractFactory("Election");
    const election = await upgrades.deployProxy(
      Election,
      [await votingToken.getAddress(), REQUIRED_TOKEN_BALANCE],
      { initializer: "initialize" }
    );

    return { votingToken, election };
  }

  // Fixture that creates an election and casts votes by multiple accounts
  async function castVoteByMultipleAccounts() {
    const accounts = [acc1, acc2, acc3, acc4, acc5];

    const { votingToken, election } = await loadFixture(deployElectionFixture);

    // Create election
    const startTime = getTimestamp(new Date()) + 3600; // 1 hour from now
    const endTime = startTime + 86400; // 24 hours from start
    await election.createElection(
      CANDIDATE_NAMES,
      CANDIDATE_ADDRESSES,
      startTime,
      endTime
    );

    // Mint tokens to accounts
    for (const acc of accounts) {
      await votingToken
        .connect(owner)
        .mint(acc.address, REQUIRED_TOKEN_BALANCE);
    }

    // Register voters
    for (const acc of accounts) {
      await election.connect(acc).registerVoter(1);
    }

    await time.increaseTo(startTime);

    const accToCandidateVote = new Map();
    accToCandidateVote.set(acc1, 0);
    accToCandidateVote.set(acc2, 1);
    accToCandidateVote.set(acc3, 2);
    accToCandidateVote.set(acc4, 1);
    accToCandidateVote.set(acc5, 1);

    // Cast votes
    for (const [acc, candidate] of accToCandidateVote.entries()) {
      await election.connect(acc).castVote(1, candidate);
    }

    return {
      votingToken,
      election,
      winningCandidate: 1,
      winningVoteCount: 3,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct token name and symbol", async function () {
      const { votingToken } = await loadFixture(deployElectionFixture);

      expect(await votingToken.name()).to.equal(VOTING_TOKEN_NAME);
      expect(await votingToken.symbol()).to.equal(VOTING_TOKEN_SYMBOL);
    });

    it("Should mint initial supply to owner", async function () {
      const { votingToken } = await loadFixture(deployElectionFixture);

      expect(await votingToken.balanceOf(owner.address)).to.equal(
        INITIAL_SUPPLY
      );
    });

    it("Should set the correct voting token address", async function () {
      const { election, votingToken } = await loadFixture(
        deployElectionFixture
      );

      expect(await election.votingToken()).to.equal(
        await votingToken.getAddress()
      );
    });

    it("Should set the correct required token balance", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      expect(await election.requiredTokenBalance()).to.equal(
        REQUIRED_TOKEN_BALANCE
      );
    });

    it("Should set the correct owner", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      expect(await election.owner()).to.equal(owner.address);
    });

    it("Should start with election ID 0", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      expect(await election.currentElectionId()).to.equal(0);
    });
  });

  describe("Mint Voting tokens", function () {
    it("Should mint tokens to other accounts from owner", async function () {
      const { votingToken } = await loadFixture(deployElectionFixture);

      const amounts = [1, 2, 3, 4, 5];
      const accounts = [acc1, acc2, acc3, acc4, acc5];
      for (let i = 0; i < amounts.length; i++) {
        await votingToken
          .connect(owner)
          .mint(accounts[i].address, ethers.parseEther(amounts[i].toString()));
      }

      for (let i = 0; i < amounts.length; i++) {
        expect(await votingToken.balanceOf(accounts[i].address)).to.equal(
          ethers.parseEther(amounts[i].toString())
        );
      }
    });

    it("Should not mint tokens to other accounts if not owner", async function () {
      const { votingToken } = await loadFixture(deployElectionFixture);

      await expect(
        votingToken.connect(acc1).mint(acc2.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(
        votingToken,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Create election", function () {
    it("Should create an election", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 3600;
      const endTime = startTime + 86400;

      await election.createElection(
        CANDIDATE_NAMES,
        CANDIDATE_ADDRESSES,
        startTime,
        endTime
      );

      // Check election details
      const electionId = await election.currentElectionId();
      expect(electionId).to.equal(1);

      // Check candidates
      for (let i = 0; i < CANDIDATE_ADDRESSES.length; i++) {
        const candidate = await election.getCandidate(electionId, i);
        expect(candidate.name).to.equal(CANDIDATE_NAMES[i]);
        expect(candidate.candidateAddress).to.equal(CANDIDATE_ADDRESSES[i]);
        expect(candidate.voters.length).to.equal(0);
      }
    });

    it("Should not allow duplicate candidates", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 3600;
      const endTime = startTime + 86400;

      await expect(
        election.createElection(
          ["Name 1", "Name 2"],
          [acc1.address, acc1.address],
          startTime,
          endTime
        )
      ).to.be.revertedWith("Duplicate candidate");
    });

    it("Should not allow zero address as candidate", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 3600;
      const endTime = startTime + 86400;

      await expect(
        election.createElection(
          ["Name 1", "Name 2"],
          [acc1.address, ethers.ZeroAddress],
          startTime,
          endTime
        )
      ).to.be.revertedWith("Invalid candidate address");
    });

    it("Should not allow empty candidate name", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 3600;
      const endTime = startTime + 86400;

      await expect(
        election.createElection(
          ["Name 1", ""],
          [acc1.address, acc2.address],
          startTime,
          endTime
        )
      ).to.be.revertedWith("Empty candidate name");
    });

    it("Should not create an election if not owner", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 3600;
      const endTime = startTime + 86400;

      await expect(
        election
          .connect(acc1)
          .createElection(
            CANDIDATE_NAMES,
            CANDIDATE_ADDRESSES,
            startTime,
            endTime
          )
      ).to.be.revertedWithCustomError(election, "OwnableUnauthorizedAccount");
    });

    it("Should not create an election if start time is not in the future", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) - 3600; // 1 hour ago
      const endTime = getTimestamp(new Date()) + 86400; // 24 hours from now

      await expect(
        election.createElection(
          CANDIDATE_NAMES,
          CANDIDATE_ADDRESSES,
          startTime,
          endTime
        )
      ).to.be.revertedWith("Start time must be in the future");
    });

    it("Should not create an election if end time is not after start time", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 3600; // 1 hour from now
      const endTime = startTime - 1; // 1 second before start time

      await expect(
        election.createElection(
          CANDIDATE_NAMES,
          CANDIDATE_ADDRESSES,
          startTime,
          endTime
        )
      ).to.be.revertedWith("End time must be after start time");
    });

    it("Should not create an election with no candidates", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 1000;
      const endTime = startTime + 1000 * 60 * 60 * 24;

      await expect(
        election.createElection(
          [], // Empty candidates array
          [], // Empty names array
          startTime,
          endTime
        )
      ).to.be.revertedWith("Must have at least one candidate");
    });

    it("Should not create an election with mismatched names and addresses", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      const startTime = getTimestamp(new Date()) + 3600;
      const endTime = startTime + 86400;

      await expect(
        election.createElection(
          ["Only One Name"],
          [acc1.address, acc2.address],
          startTime,
          endTime
        )
      ).to.be.revertedWith("Names and addresses length mismatch");
    });
  });

  describe("Register voter", function () {
    it("Should register a voter", async function () {
      const { election, votingToken } = await loadFixture(
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

      await votingToken
        .connect(owner)
        .mint(acc1.address, REQUIRED_TOKEN_BALANCE);
      await election.connect(acc1).registerVoter(1);

      expect(await election.isRegisteredVoter(1, acc1.address)).to.equal(true);
    });

    it("Should not allow registration after election starts", async function () {
      const { election, votingToken } = await loadFixture(
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

      await votingToken
        .connect(owner)
        .mint(acc1.address, REQUIRED_TOKEN_BALANCE);

      await time.increaseTo(startTime);

      await expect(election.connect(acc1).registerVoter(1)).to.be.revertedWith(
        "Registration period has ended"
      );
    });
  });

  describe("Cast vote", function () {
    it("Should allow registered voters to vote", async function () {
      const { election, votingToken } = await loadFixture(
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

      await votingToken
        .connect(owner)
        .mint(acc1.address, REQUIRED_TOKEN_BALANCE);
      await election.connect(acc1).registerVoter(1);

      await time.increaseTo(startTime);

      await expect(election.connect(acc1).castVote(1, 0)).not.to.be.reverted;

      // Check if the vote was counted
      const candidate = await election.getCandidate(1, 0);
      expect(candidate.voters.length).to.equal(1);
      expect(candidate.voters[0]).to.equal(acc1.address);

      // Check voters list after election is finalized
      await time.increaseTo(endTime + 1);
      await election.finalizeElection(1);
      const voters = await election.getCandidateVoters(1, 0);
      expect(voters).to.deep.equal([acc1.address]);
    });

    it("Should track voters for each candidate", async function () {
      const { election, votingToken } = await loadFixture(
        deployElectionFixture
      );

      const startTime = getTimestamp(new Date()) + 3600;
      const endTime = startTime + 86400;

      // Create election
      await election.createElection(
        CANDIDATE_NAMES,
        CANDIDATE_ADDRESSES,
        startTime,
        endTime
      );

      // Register and fund multiple voters
      const voters = [acc1, acc2, acc3];
      for (const voter of voters) {
        await votingToken
          .connect(owner)
          .mint(voter.address, REQUIRED_TOKEN_BALANCE);
        await election.connect(voter).registerVoter(1);
      }

      // Move to election start
      await time.increaseTo(startTime);

      // Cast votes
      await election.connect(acc1).castVote(1, 0);
      await election.connect(acc2).castVote(1, 0);
      await election.connect(acc3).castVote(1, 1);

      // Move past election end and finalize
      await time.increaseTo(endTime + 1);
      await election.finalizeElection(1);

      // Check voters for candidate 0
      const candidate0Voters = await election.getCandidateVoters(1, 0);
      expect(candidate0Voters).to.have.length(2);
      expect(candidate0Voters).to.include(acc1.address);
      expect(candidate0Voters).to.include(acc2.address);

      // Check voters for candidate 1
      const candidate1Voters = await election.getCandidateVoters(1, 1);
      expect(candidate1Voters).to.have.length(1);
      expect(candidate1Voters).to.include(acc3.address);
    });

    it("Should not allow viewing voters before election is finalized", async function () {
      const { election, votingToken } = await loadFixture(
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

      await votingToken
        .connect(owner)
        .mint(acc1.address, REQUIRED_TOKEN_BALANCE);
      await election.connect(acc1).registerVoter(1);

      await time.increaseTo(startTime);
      await election.connect(acc1).castVote(1, 0);

      await expect(election.getCandidateVoters(1, 0)).to.be.revertedWith(
        "Can only view voters after election is finalized"
      );
    });
  });

  describe("Get leading candidate", function () {
    it("Should get the leading candidate", async function () {
      const { election, winningCandidate, winningVoteCount } =
        await castVoteByMultipleAccounts();

      const leadingCandidate = await election.getLeadingCandidate(1);
      expect(leadingCandidate[0]).to.equal(winningCandidate);
      expect(leadingCandidate[1]).to.equal(
        CANDIDATE_ADDRESSES[winningCandidate]
      );
      expect(leadingCandidate[2]).to.equal(winningVoteCount);
    });
  });

  describe("Finalize election", function () {
    it("Should finalize an election", async function () {
      const { election } = await castVoteByMultipleAccounts();
      const electionDetails = await election.getElectionDetails(1);

      await time.increaseTo(Number(electionDetails.endTime) + 1);

      await election.finalizeElection(1);

      const finalizedElection = await election.getElectionDetails(1);
      expect(finalizedElection.isFinalized).to.equal(true);
    });

    it("Should not allow finalizing from non-owner", async function () {
      const { election } = await loadFixture(deployElectionFixture);

      await expect(
        election.connect(acc1).finalizeElection(1)
      ).to.be.revertedWithCustomError(election, "OwnableUnauthorizedAccount");
    });

    it("Should not allow finalizing an election that is ongoing", async function () {
      const { election } = await castVoteByMultipleAccounts();

      await expect(election.finalizeElection(1)).to.be.revertedWith(
        "Election is still ongoing"
      );
    });

    it("Should not finalizing an already finalized election", async function () {
      const { election } = await castVoteByMultipleAccounts();
      const electionDetails = await election.getElectionDetails(1);

      await time.increaseTo(Number(electionDetails.endTime));
      await election.finalizeElection(1);

      await expect(election.finalizeElection(1)).to.be.revertedWith(
        "Election already finalized"
      );
    });
  });
});

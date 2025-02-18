// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Election is Ownable, ReentrancyGuard {
    struct Candidate {
        address candidateAddress;
        address[] voters;
    }

    struct ElectionDetails {
        Candidate[] candidates;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool isFinalized;
        mapping(address => bool) hasVoted;
        mapping(address => bool) isRegistered;
        uint256 totalVotes;
        uint256 totalRegistered;
    }

    IERC20 public votingToken;
    uint256 public requiredTokenBalance;

    uint256 public currentElectionId;
    mapping(uint256 => ElectionDetails) public elections;

    event ElectionCreated(
        uint256 indexed electionId,
        uint256 startTime,
        uint256 endTime
    );
    event VoterRegistered(uint256 indexed electionId, address indexed voter);
    event VoteCast(
        uint256 indexed electionId,
        address indexed voter,
        uint256 candidateIndex
    );
    event ElectionFinalized(
        uint256 indexed electionId,
        uint256 winningCandidateIndex
    );

    constructor(
        address _votingToken,
        uint256 _requiredTokenBalance
    ) Ownable(msg.sender) {
        votingToken = IERC20(_votingToken);
        requiredTokenBalance = _requiredTokenBalance;
    }

    function createElection(
        address[] memory candidateAddresses,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner {
        require(
            startTime > block.timestamp,
            "Start time must be in the future"
        );
        require(endTime > startTime, "End time must be after start time");
        require(
            candidateAddresses.length > 0,
            "Must have at least one candidate"
        );

        for (uint i = 0; i < candidateAddresses.length; i++) {
            require(
                candidateAddresses[i] != address(0),
                "Invalid candidate address"
            );
            for (uint j = i + 1; j < candidateAddresses.length; j++) {
                require(
                    candidateAddresses[i] != candidateAddresses[j],
                    "Duplicate candidate"
                );
            }
        }

        currentElectionId++;
        ElectionDetails storage election = elections[currentElectionId];
        election.startTime = startTime;
        election.endTime = endTime;
        election.isActive = false;
        election.isFinalized = false;

        for (uint256 i = 0; i < candidateAddresses.length; i++) {
            election.candidates.push(
                Candidate({
                    candidateAddress: candidateAddresses[i],
                    voters: new address[](0)
                })
            );
        }

        emit ElectionCreated(currentElectionId, startTime, endTime);
    }

    function registerVoter(uint256 electionId) external {
        ElectionDetails storage election = elections[electionId];
        require(
            !election.isRegistered[msg.sender],
            "Already registered for this election"
        );
        require(
            block.timestamp < election.startTime,
            "Registration period has ended"
        );
        require(!election.isFinalized, "Election is finalized");
        require(
            votingToken.balanceOf(msg.sender) >= requiredTokenBalance,
            "Insufficient token balance"
        );

        election.isRegistered[msg.sender] = true;
        election.totalRegistered++;
        emit VoterRegistered(electionId, msg.sender);
    }

    function castVote(uint256 electionId, uint256 candidateIndex) external {
        ElectionDetails storage election = elections[electionId];
        require(
            election.isRegistered[msg.sender],
            "Not registered for this election"
        );
        require(
            block.timestamp >= election.startTime,
            "Election has not started"
        );
        require(block.timestamp <= election.endTime, "Election has ended");
        require(!election.isFinalized, "Election is finalized");
        require(!election.hasVoted[msg.sender], "Already voted");
        require(
            candidateIndex < election.candidates.length,
            "Invalid candidate"
        );

        election.hasVoted[msg.sender] = true;
        election.candidates[candidateIndex].voters.push(msg.sender);
        election.totalVotes++;

        emit VoteCast(electionId, msg.sender, candidateIndex);
    }

    function getLeadingCandidate(
        uint256 electionId
    ) public view returns (uint256, address, uint256) {
        ElectionDetails storage election = elections[electionId];
        require(election.candidates.length > 0, "No candidates");

        uint256 leadingIndex = 0;
        uint256 maxVotes = 0;

        for (uint256 i = 0; i < election.candidates.length; i++) {
            uint256 currentVotes = election.candidates[i].voters.length;
            if (currentVotes > maxVotes) {
                maxVotes = currentVotes;
                leadingIndex = i;
            }
        }

        return (
            leadingIndex,
            election.candidates[leadingIndex].candidateAddress,
            election.candidates[leadingIndex].voters.length
        );
    }

    function finalizeElection(uint256 electionId) external onlyOwner {
        ElectionDetails storage election = elections[electionId];
        require(
            block.timestamp > election.endTime,
            "Election is still ongoing"
        );
        require(!election.isFinalized, "Election already finalized");

        election.isFinalized = true;
        (uint256 winningIndex, , ) = getLeadingCandidate(electionId);
        emit ElectionFinalized(electionId, winningIndex);
    }

    function getElectionDetails(
        uint256 electionId
    )
        external
        view
        returns (
            uint256 startTime,
            uint256 endTime,
            bool isActive,
            bool isFinalized,
            uint256 totalVotes,
            uint256 candidateCount,
            uint256 totalRegistered
        )
    {
        ElectionDetails storage election = elections[electionId];
        return (
            election.startTime,
            election.endTime,
            election.isActive,
            election.isFinalized,
            election.totalVotes,
            election.candidates.length,
            election.totalRegistered
        );
    }

    function getCandidate(
        uint256 electionId,
        uint256 candidateIndex
    )
        external
        view
        returns (address candidateAddress, address[] memory voters)
    {
        ElectionDetails storage election = elections[electionId];
        require(
            candidateIndex < election.candidates.length,
            "Invalid candidate index"
        );

        Candidate memory candidate = election.candidates[candidateIndex];
        return (candidate.candidateAddress, candidate.voters);
    }

    function isRegisteredVoter(
        uint256 electionId,
        address voter
    ) external view returns (bool) {
        return elections[electionId].isRegistered[voter];
    }

    function getCandidateVoters(
        uint256 electionId,
        uint256 candidateIndex
    ) external view returns (address[] memory) {
        ElectionDetails storage election = elections[electionId];
        require(
            candidateIndex < election.candidates.length,
            "Invalid candidate index"
        );
        require(
            election.isFinalized,
            "Can only view voters after election is finalized"
        );

        return election.candidates[candidateIndex].voters;
    }
}

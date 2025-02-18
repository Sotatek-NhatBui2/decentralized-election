import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const VOTING_TOKEN_NAME = "Voting Token";
const VOTING_TOKEN_SYMBOL = "VOTE";

// 1 million tokens with 18 decimals
const INITIAL_SUPPLY = BigInt("1000000000000000000000000");
// Require 100 tokens to register as voter
const REQUIRED_TOKEN_BALANCE = BigInt("1000000000000000000");

export default buildModule("ElectionModule", (m) => {
  const votingToken = m.contract("VotingToken", [
    m.getParameter("election.votingTokenName", VOTING_TOKEN_NAME),
    m.getParameter("election.votingTokenSymbol", VOTING_TOKEN_SYMBOL),
    m.getParameter("election.initialSupply", INITIAL_SUPPLY), // default: 1 million tokens
  ]);

  const election = m.contract("Election", [
    votingToken,
    m.getParameter("election.requiredTokenBalance", REQUIRED_TOKEN_BALANCE), // default: 1 token
  ]);

  return { votingToken, election };
});

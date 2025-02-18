# Decentralized Election System

## Requirements

### Basic

- The contract owner can create a new election with multiple candidates.
- Registered voters can cast their votes.
- The contract ensures each voter can vote only once.
- The results can be retrieved after the election ends.

### Details

- Owner Privileges:
  - The contract owner can create a new election with a list of candidates name and address. Elections should have a start date and end date.
  - The owner can finalize the election when voting is complete.
- Voters:
  - A voter can register before voting starts. Voters are required to hold a fixed amount of tokens (ERC20) before registering.
  - A voter can vote only once.
  - Voting should only be allowed when the election is active.
- Vote Tracking:
  - Use structs and mappings to store candidate details and votes.
  - Emit an event when a vote is cast.
- Result Retrieval:
  - Anyone can check the current leading candidate of the specific election at any time.
  - After voting ends, the final results should be available.

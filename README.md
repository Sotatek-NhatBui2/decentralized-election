# Decentralized Election System

## Election contract

### Requirements

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

## Vesting contract

### Objective

- Part 1: Upgrade the Election Contract
  - Integrate an ERC20 token reward that will be sent to the vesting contract after the election ends.
  - Implement logic to split the reward if multiple candidates tie.
  - Ensure that rewards are locked in a vesting contract.
- Part 2: Implement the Token Vesting Contract
  - The vesting contract should:
    - Unlock 10% of the reward each month.
    - Allow winners to claim their unlocked tokens.
    - Prevent claiming before the unlock period.

### Requirements

- Access Control:
  - Only allowed address can add a new vesting schedule.
- Beneficiary:
  - A beneficiary needs to be a winner of the election.
- VestingTracking:
  - Use structs and mappings to store vesting data.
  - Emit an event when a new vesting is added or user claims tokens.
- Vesting query:
  - Users can check for claimable amount, unlocked amount and claimed amount of their assets.

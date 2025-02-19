// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract VestingContract is Ownable, ReentrancyGuard {
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 startTime;
        uint256 claimedAmount;
    }

    mapping(address => VestingSchedule) public vestingSchedules;

    IERC20 public rewardToken;

    uint256 public constant VESTING_UNLOCK_TIMES = 10; // 10 times to unlock all the reward
    uint256 public constant VESTING_UNLOCK_PERIOD = 30 days; // 30 days to unlock a part of the reward

    event VestingScheduleCreated(
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 startTime
    );

    event VestingScheduleClaimed(address indexed beneficiary, uint256 amount);

    constructor(address _rewardToken) Ownable(msg.sender) {
        rewardToken = IERC20(_rewardToken);
    }

    function createVestingSchedule(
        address _beneficiary,
        uint256 _totalAmount
    ) external onlyOwner {
        if (vestingSchedules[_beneficiary].startTime != 0) {
            revert("Vesting schedule already exists");
        }
        require(_totalAmount > 0, "Total amount must be greater than 0");

        vestingSchedules[_beneficiary] = VestingSchedule({
            totalAmount: _totalAmount,
            startTime: block.timestamp,
            claimedAmount: 0
        });

        emit VestingScheduleCreated(
            _beneficiary,
            _totalAmount,
            block.timestamp
        );
    }

    function getVestingScheduleData()
        public
        view
        returns (
            uint256 totalAmount,
            uint256 startTime,
            uint256 unlockedAmount,
            uint256 claimedAmount
        )
    {
        VestingSchedule memory schedule = vestingSchedules[msg.sender];

        totalAmount = schedule.totalAmount;
        startTime = schedule.startTime;

        uint256 passedPeriods = (block.timestamp - schedule.startTime) /
            VESTING_UNLOCK_PERIOD;
        if (passedPeriods > VESTING_UNLOCK_TIMES) {
            passedPeriods = VESTING_UNLOCK_TIMES;
        }

        unlockedAmount =
            (schedule.totalAmount / VESTING_UNLOCK_TIMES) *
            passedPeriods;
        claimedAmount = schedule.claimedAmount;
    }

    function claimReward(uint256 _amount) external nonReentrant {
        VestingSchedule memory schedule = vestingSchedules[msg.sender];
        if (schedule.startTime == 0) {
            revert("Vesting schedule not found");
        }

        require(_amount > 0, "Amount must be greater than 0");

        // Check passed periods
        uint256 passedPeriods = (block.timestamp - schedule.startTime) /
            VESTING_UNLOCK_PERIOD;
        if (passedPeriods > VESTING_UNLOCK_TIMES) {
            passedPeriods = VESTING_UNLOCK_TIMES;
        }

        // Get unlocked amount
        uint256 unlockedAmount = (schedule.totalAmount / VESTING_UNLOCK_TIMES) *
            passedPeriods;

        // Get claimable amount
        uint256 claimableAmount = unlockedAmount - schedule.claimedAmount;
        require(_amount <= claimableAmount, "Insufficient claimable amount");

        vestingSchedules[msg.sender].claimedAmount += _amount;

        rewardToken.transfer(msg.sender, _amount);
 
        emit VestingScheduleClaimed(msg.sender, _amount);
    }
}

import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv'
import readline from 'readline';

dotenv.config()

// Set up Apollo Client
const client = new ApolloClient({
  link: createHttpLink({
    uri: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
    fetch,
    headers: {
      'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
    },
  }),
  cache: new InMemoryCache(),
});

// Add this retry helper function at the top of the file
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt}/${maxRetries} failed. Retrying in ${delay/1000}s...`);
      console.log(error);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff
      delay *= 2;
    }
  }
  
  throw lastError;
}

// Updated GraphQL query for user reaction ranks
const GET_USER_REACTION_RANKS = gql`
  query GetUserReactionRanks($startWeek: timestamptz!) {
    weekly_rolling_rank_user_reactions_with_history3(
      where: { start_week: { _eq: $startWeek } }
      order_by: { user_rank: asc }
      limit: 15
    ) {
      user_id
      current_score
      user_rank
      start_week
      user {
        username
      }
    }
  }
`;

// Updated function to get user reaction ranks for a specific start week
async function getUserReactionRanks(startWeek: string) {
  try {
    const { data } = await client.query({
      query: GET_USER_REACTION_RANKS,
      variables: { startWeek },
    });

    return data.weekly_rolling_rank_user_reactions_with_history3;
  } catch (error) {
    console.error('Error fetching user reaction ranks:', error);
    throw error;
  }
}

const GET_TREASURY_BALANCE = gql`
  query GetTreasuryBalance($timestamp: timestamptz!) {
    user_balances_assets_history(
      where: {
        user_id: { _eq: 0 },
        asset_id: { _eq: 1 },
        transaction_timestamp: { _lte: $timestamp }
      }
      order_by: { transaction_timestamp: desc }
      limit: 1
    ) {
      cumulative_amount
      transaction_timestamp
    }
  }
`;

async function getTreasuryBalance(timestamp: string) {
  try {
    const { data } = await client.query({
      query: GET_TREASURY_BALANCE,
      variables: { timestamp },
    });
    return data.user_balances_assets_history[0];
  } catch (error) {
    console.error('Error fetching treasury balance:', error);
    throw error;
  }
}

const GET_TOKEN_HOLDERS = gql`
  query GetTokenHolders($userIds: [bigint], $timestamp: timestamptz) {
    user_balances_assets_history(
      distinct_on: [external_id, user_id]
      where: {
        external_id: { _in: $userIds },
        transaction_timestamp: { _lte: $timestamp }
      }
      order_by: [
        { external_id: asc },
        { user_id: asc },
        { transaction_timestamp: desc }
      ]
    ) {
      user_id
      external_id
      cumulative_amount
      transaction_timestamp
      user {
        username
      }
    }
  }
`;

async function getTokenHolders(userIds: number[], timestamp: string) {
  try {
    const { data } = await client.query({
      query: GET_TOKEN_HOLDERS,
      variables: { userIds, timestamp },
    });
    return data.user_balances_assets_history;
  } catch (error) {
    console.error('Error fetching token holders:', error);
    throw error;
  }
}

// Add this new GraphQL mutation near the other queries
const TRANSFER_ASSET = gql`
  mutation TransferAsset($fromUserId: bigint!, $toUserId: bigint!, $amount: numeric!) {
    transfer_asset(args: {
      p_from_user_id: $fromUserId, 
      p_to_user_id: $toUserId, 
      p_amount: $amount
    }) {
      id
      user_id
      amount
    }
  }
`;

// Update the transfer asset function
async function transferAsset(fromUserId: number, toUserId: number, amount: number) {
  return retryOperation(async () => {
    const { data } = await client.mutate({
      mutation: TRANSFER_ASSET,
      variables: { fromUserId, toUserId, amount },
    });
    return data.transfer_asset;
  });
}

// Add this helper function for user confirmation
function askForConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Add this new GraphQL mutation near the other queries
const INSERT_WON_NOTIFICATION = gql`
  mutation InsertWonReactionCompetitionNotification(
    $userId: bigint
    $rank: Int
    $usdcAmount: numeric
  ) {
    insert_notifications_one(
      object: {
        for: $userId
        type: "wonReactionCompetition"
        rank: $rank
        usdc_amount: $usdcAmount
        is_checked: false
      }
    ) {
      id
      type
      rank
      usdc_amount
    }
  }
`;

// Update the winning notification function
async function sendWinningNotification(userId: string, rank: number, amount: number) {
  return retryOperation(async () => {
    const { data } = await client.mutate({
      mutation: INSERT_WON_NOTIFICATION,
      variables: {
        userId,
        rank,
        usdcAmount: amount
      }
    });
    return data.insert_notifications_one;
  });
}

// Add this new GraphQL mutation near the other queries
const INSERT_DIVIDENDS_NOTIFICATION = gql`
  mutation InsertEarnedSharesDividendsNotification(
    $userId: bigint
    $userFromId: bigint
    $rank: Int
    $usdcAmount: numeric
  ) {
    insert_notifications_one(
      object: {
        for: $userId
        from: $userFromId
        type: "earnedSharesDividends"
        rank: $rank
        usdc_amount: $usdcAmount
        is_checked: false
      }
    ) {
      id
      type
      rank
      usdc_amount
    }
  }
`;

// Update the dividends notification function
async function sendDividendsNotification(
  userId: number, 
  creatorId: number, 
  creatorRank: number, 
  amount: number
) {
  return retryOperation(async () => {
    const { data } = await client.mutate({
      mutation: INSERT_DIVIDENDS_NOTIFICATION,
      variables: {
        userId,
        userFromId: creatorId,
        rank: creatorRank,
        usdcAmount: amount
      }
    });
    return data.insert_notifications_one;
  });
}

// Updated main function
async function main() {
  try {
    const startWeek = '2024-10-21';
    const timestamp = '2024-10-27T07:00:00Z';
    
    const rankings = await getUserReactionRanks(startWeek);
    const [treasuryBalance, tokenHolders] = await Promise.all([
      getTreasuryBalance(timestamp),
      getTokenHolders(rankings.map((r: any) => r.user_id), timestamp)
    ]);
    
    const rewardPool = treasuryBalance.cumulative_amount;
    console.log(`Treasury USDC Balance at ${timestamp}:`, rewardPool);
    console.log('----------------------------------------');
    
    // Group holders by creator and calculate total supply
    const holdersByCreator = tokenHolders.reduce((acc: any, holder: any) => {
      if (!acc[holder.external_id]) {
        acc[holder.external_id] = {
          holders: [],
          totalSupply: 0
        };
      }
      acc[holder.external_id].holders.push({
        holder_id: holder.user_id,
        username: holder.user.username,
        amount: holder.cumulative_amount
      });
      acc[holder.external_id].totalSupply += Number(holder.cumulative_amount);
      return acc;
    }, {});

    // First pass: Calculate total share of rewards
    const totalShareOfRewards = rankings.reduce((total: number, entry: any) => {
      const shareOfRewardPool = 1 - Math.pow(Math.log(entry.user_rank) / Math.log(15), 1.5);
      return total + shareOfRewardPool;
    }, 0);

    // Track all transfers to be made
    const transfers: { toUserId: number; amount: number, creator: boolean }[] = [];

    // Second pass: Calculate and distribute rewards
    rankings.forEach((entry: any) => {
      const creatorData = holdersByCreator[entry.user_id] || { holders: [], totalSupply: 0 };
      
      // Calculate share of the reward pool based on ranking
      const shareOfRewardPool = 1 - Math.pow(Math.log(entry.user_rank) / Math.log(15), 1.5);
      
      // Calculate reward in USDC (normalized by total share)
      const rewardInUSDC = (rewardPool * shareOfRewardPool) / totalShareOfRewards;
      const userRewardInUSDC = rewardInUSDC * 0.5; // 50% goes to the creator
      const holdersRewardInUSDC = rewardInUSDC * 0.5; // 50% goes to holders
      
      // Add creator reward to transfers array
      transfers.push({
        toUserId: entry.user_id,
        amount: userRewardInUSDC,
        creator: true
      });

      console.log(`User: ${entry.user.username} (${entry.user_id})`);
      console.log(`Current Score: ${entry.current_score}`);
      console.log(`Rank: ${entry.user_rank}`);
      console.log(`Share of Reward Pool: ${(shareOfRewardPool * 100 / totalShareOfRewards).toFixed(2)}%`);
      console.log(`Total Share Supply: ${creatorData.totalSupply}`);
      console.log(`Creator Reward: ${userRewardInUSDC.toFixed(2)} USDC`);
      console.log('Token Holders:');
      
      // Calculate holder rewards and add to transfers array
      creatorData.holders.forEach((holder: any) => {
        const holderShare = Number(holder.amount) / creatorData.totalSupply;
        const holderReward = holdersRewardInUSDC * holderShare;
        
        transfers.push({
          toUserId: holder.holder_id,
          amount: holderReward,
          creator: false
        });

        console.log(`  Holder: ${holder.username} (${holder.holder_id})`);
        console.log(`    Amount: ${holder.amount} (${(holderShare * 100).toFixed(2)}%)`);
        console.log(`    Reward: ${holderReward.toFixed(2)} USDC`);
      });
      console.log('----------------------------------------');
    });

    console.log('\nTransfers to be executed:');
    let totalAmount = 0;
    transfers.forEach(transfer => {
      console.log(`User ${transfer.toUserId}: ${transfer.amount.toFixed(2)} USDC ${transfer.creator ? '(creator)' : '(holder)'}`);
      totalAmount += transfer.amount;
    });
    console.log(`\nTotal amount to be transferred: ${totalAmount.toFixed(2)} USDC`);

    // Ask for confirmation
    const shouldProceed = await askForConfirmation('\nDo you want to proceed with these transfers? (y/n): ');

    if (!shouldProceed) {
      console.log('Transfer operation cancelled by user');
      return;
    }

    // console.log('\nExecuting transfers...');
    // const TREASURY_USER_ID = 0; // Replace with actual treasury user ID
    // for (const transfer of transfers) {
    //   if (transfer.amount > 0) {
    //     console.log(`Transferring ${transfer.amount.toFixed(2)} USDC to user ${
    //       transfer.toUserId
    //     }`);
    //     try {
    //     //   await transferAsset(TREASURY_USER_ID, transfer.toUserId, transfer.amount);
    //       console.log('Transfer successful');
    //     } catch (error) {
    //       console.error(`Failed to transfer to user ${transfer.toUserId}:`, error);
    //     }
    //   }
    // }

    // console.log('All transfers completed');

    console.log('\nSending notifications...');
    for (const entry of rankings) {
      const creatorData = holdersByCreator[entry.user_id] || { holders: [], totalSupply: 0 };
      const shareOfRewardPool = 1 - Math.pow(Math.log(entry.user_rank) / Math.log(15), 1.5);
      const rewardInUSDC = (rewardPool * shareOfRewardPool) / totalShareOfRewards;
      const userRewardInUSDC = rewardInUSDC * 0.5;
      const holdersRewardInUSDC = rewardInUSDC * 0.5;

      // Send notification to creator
      try {
        await sendWinningNotification(
          entry.user_id,
          entry.user_rank,
          userRewardInUSDC
        );
        console.log(`Competition win notification sent to ${entry.user.username} (rank: ${entry.user_rank})`);
      } catch (error) {
        console.error(`Failed to send competition notification to user ${entry.user.username}:`, error);
      }

      // Send notifications to all holders
      for (const holder of creatorData.holders) {
        const holderShare = Number(holder.amount) / creatorData.totalSupply;
        const holderReward = holdersRewardInUSDC * holderShare;

        if (holderReward > 0) {
          try {
            await sendDividendsNotification(
              holder.holder_id,
              entry.user_id,
              entry.user_rank,
              holderReward
            );
            console.log(`Dividends notification sent to ${holder.username} for creator ${entry.user.username}`);
          } catch (error) {
            console.error(`Failed to send dividends notification to holder ${holder.username}:`, error);
          }
        }
      }
    }
    console.log('All notifications sent');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

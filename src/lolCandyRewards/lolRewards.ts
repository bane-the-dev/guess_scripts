import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv'
import * as readline from 'readline';

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

// GraphQL query to get weekly user rankings
const GET_WEEKLY_RANKINGS = gql`
  query GetWeeklyRankings($start_week: timestamptz!) {
    weekly_rolling_rank_user_reactions_with_history3(
      where: {start_week: {_eq: $start_week}},
      order_by: {user_rank: asc}
    ) {
      user_id
      start_week
      current_score
      user_rank
      user {
        username
      }
    }
  }
`;

// Add a query to get all available weeks
const GET_ALL_WEEKS = gql`
  query GetAllWeeks {
    weekly_rolling_rank_user_reactions_with_history3(
      distinct_on: start_week
      order_by: {start_week: asc}
    ) {
      start_week
    }
  }
`;

// Function to get all available weeks
async function getAllWeeks() {
  try {
    const { data } = await client.query({
      query: GET_ALL_WEEKS,
    });
    return data.weekly_rolling_rank_user_reactions_with_history3.map(entry => entry.start_week);
  } catch (error) {
    console.error('Error fetching weeks:', error);
    throw error;
  }
}

async function getWeeklyRankings(startWeek: string) {
  try {
    const { data } = await client.query({
      query: GET_WEEKLY_RANKINGS,
      variables: { start_week: startWeek },
    });

    return data.weekly_rolling_rank_user_reactions_with_history3.map(entry => ({
      userId: entry.user_id,
      username: entry.user.username,
      startWeek: entry.start_week,
      score: entry.current_score,
      rank: entry.user_rank,
    }));
  } catch (error) {
    console.error('Error fetching weekly rankings:', error);
    throw error;
  }
}

// Calculate candy rewards based on rank and user count
function calculateCandyRewards(rank: number, userCount: number): number {
  const percentOfUsers = (rank / userCount) * 100;

  if (percentOfUsers < 1) {
    return 10000; // Top 1%
  } else if (percentOfUsers < 10) {
    return 2500;  // Top 10%
  } else if (percentOfUsers < 25) {
    return 500;  // Top 25%
  } else if (percentOfUsers < 50) {
    return 250;  // Top 50%
  } else {
    return 0;    // Bottom 50%
  }
}

// GraphQL mutations for updating candy balance and notifications
const INCREMENT_USER_CANDY = gql`
  mutation IncrementUserCandy($userId: bigint!, $candyIncrement: Int!) {
    update_users_by_pk(
      pk_columns: {id: $userId}, 
      _inc: {gold_bars: $candyIncrement}
    ) {
      id
      gold_bars
    }
  }
`;

async function incrementUserCandy(userId: string, username: string, candyIncrement: number) {
  try {
    if (candyIncrement > 0) {
      console.log(`[DRY RUN] Would increment ${candyIncrement} candy for ${username}`);
      const result = await client.mutate({
        mutation: INCREMENT_USER_CANDY,
        variables: { userId, candyIncrement },
      });
      return result.data.update_users_by_pk.candy;
      // return candyIncrement; // Just return the increment for dry run
    }
    return null;
  } catch (error) {
    console.error(`Error incrementing candy for ${username}:`, error);
    throw error;
  }
}

// User input helper function
function getUserInput(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// Main function
async function main() {
  try {
    console.log('\n[INFO] Fetching all available weeks...');
    const allWeeks = await getAllWeeks();
    console.log(`[INFO] Found ${allWeeks.length} weeks to process`);

    for (const startWeek of allWeeks) {
      console.log('\n========================================');
      console.log(`[INFO] Processing week: ${startWeek}`);
      console.log('========================================\n');
      
      const rankings = await getWeeklyRankings(startWeek);
      console.log(`[INFO] Retrieved ${rankings.length} total rankings`);
      
      // Remove users with the lowest rank
      const lowestRank = Math.max(...rankings.map(r => r.rank));
      const filteredRankings = rankings.filter(r => r.rank < lowestRank);
      console.log(`[INFO] Filtered to ${filteredRankings.length} users after removing lowest rank (${lowestRank})`);
      
      const userCount = filteredRankings.length;

      console.log("\n=== Distribution Summary ===");
      console.log("Week starting:", startWeek);
      console.log("Total eligible users:", userCount);
      
      console.log("\n=== Candy Distribution Details ===");
      const candyDistribution = filteredRankings.map(ranking => {
        const candy = calculateCandyRewards(ranking.rank, userCount);
        console.log(`${ranking.username} (Rank ${ranking.rank}, Score ${ranking.score}): ${candy} candy`);
        return { ...ranking, candy };
      });

      // Calculate totals
      const totalCandy = candyDistribution.reduce((sum, user) => sum + user.candy, 0);
      const rewardedUsers = candyDistribution.filter(user => user.candy > 0).length;
      
      console.log("\n=== Distribution Statistics ===");
      console.log(`Total candy to be distributed: ${totalCandy}`);
      console.log(`Users receiving rewards: ${rewardedUsers} (${((rewardedUsers/userCount) * 100).toFixed(1)}%)`);
      
      const confirmation = await getUserInput(`\nDo you want to proceed with updating the candy balances for week ${startWeek}? (yes/no): `);

      if (confirmation.toLowerCase() === 'yes') {
        console.log('\n[DRY RUN] Starting candy distribution...');
        for (const user of candyDistribution) {
          const newBalance = await incrementUserCandy(user.userId, user.username, user.candy);
          console.log(`[DRY RUN] Would update ${user.username} (Rank ${user.rank}): +${user.candy} candy`);
        }
        console.log('\n[DRY RUN] Simulation complete for this week - no actual DB changes were made');
      } else {
        console.log('Skipping this week. No changes were made to the database.');
      }
    }

    console.log('\n[INFO] Finished processing all weeks!');
  } catch (error) {
    console.error('[ERROR] An error occurred:', error);
  }
}

main();
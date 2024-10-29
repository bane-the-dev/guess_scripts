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

// GraphQL query to get user rankings for reactions on a specific date
const GET_USER_REACTION_RANKINGS = gql`
  query GetUserReactionRankings($date: date!) {
    daily_user_reactions(where: {date: {_eq: $date}}, order_by: {rank: asc}) {
      user_id
      date
      reaction_count
      rank
      user {
        username
      }
    }
  }
`;

// GraphQL query to get the total number of reactions for a specific date
const GET_REACTION_COUNT = gql`
  query GetReactionCount($date: date!) {
    reactions_aggregate(where: {created_at: {_gte: $date, _lt: $date}}) {
      aggregate {
        count
      }
    }
  }
`;

// Function to get user reaction rankings for a specific date
async function getUserReactionRankings(date: string) {
  try {
    const { data } = await client.query({
      query: GET_USER_REACTION_RANKINGS,
      variables: { date },
    });

    return data.daily_user_reactions.map(entry => ({
      userId: entry.user_id,
      username: entry.user.username,
      date: entry.date,
      reactionCount: entry.reaction_count,
      rank: entry.rank,
    }));
  } catch (error) {
    console.error('Error fetching user reaction rankings:', error);
    throw error;
  }
}

// Function to get the total reaction count for a specific date
async function getReactionCount(date: string): Promise<number> {
  try {
    const { data } = await client.query({
      query: GET_REACTION_COUNT,
      variables: { date },
    });
    return data.reactions_aggregate.aggregate.count;
  } catch (error) {
    console.error('Error fetching reaction count:', error);
    throw error;
  }
}

// Function to calculate gem distribution
function calculateGems(rank: number, userCount: number, reactionCount: number): number {
  const percentOfUsers = (rank / userCount) * 100

  if(percentOfUsers < 1) {
    return reactionCount * 45
  } else if (percentOfUsers < 10) {
    return reactionCount * 15
  } else if (percentOfUsers < 25) {
    return reactionCount * 4
  } else if (percentOfUsers < 50) {
    return reactionCount
  } else {
    return 0
  }
}

// GraphQL mutation to increment user gems
const INCREMENT_USER_GEMS = gql`
  mutation IncrementUserGems($userId: bigint!, $gemIncrement: Int!) {
    update_users_by_pk(
      pk_columns: {id: $userId}, 
      _inc: {gems: $gemIncrement}
    ) {
      id
      gems
    }
  }
`;

// GraphQL mutation for inserting a notification
const INSERT_NOTIFICATION = gql`
  mutation InsertNotification($userId: bigint!, $type: String!, $gemAmount: Int, $rank: Int, $competition_name: String) {
    insert_notifications_one(object: {
      for: $userId,
      type: $type,
      gem_amount: $gemAmount,
      rank: $rank,
      competition_name: $competition_name
    }) {
      id
    }
  }
`;

// Function to increment user gems and send notifications
async function incrementUserGemsAndNotify(userId: string, gemIncrement: number, rank: number) {
  try {
    const promises = [
      client.mutate({
        mutation: INSERT_NOTIFICATION,
        variables: { userId, type: "rank", rank: rank, competition_name: "reactions" },
      })
    ];

    if (gemIncrement > 0) {
      promises.push(
        client.mutate({
          mutation: INCREMENT_USER_GEMS,
          variables: { userId, gemIncrement },
        }),
        client.mutate({
          mutation: INSERT_NOTIFICATION,
          variables: { userId, type: "prize", gemAmount: gemIncrement },
        })
      );
    }

    const results = await Promise.all(promises);
    return gemIncrement > 0 ? results[1].data.update_users_by_pk.gems : null;
  } catch (error) {
    console.error(`Error incrementing gems and sending notifications for user ${userId}:`, error);
    throw error;
  }
}

// Function to get user input
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
    const date = '2024-10-14'
    const [rankings, reactionCount] = await Promise.all([
      getUserReactionRankings(date),
      getReactionCount(date)
    ]);
    
    // Remove users with the lowest rank
    const lowestRank = Math.max(...rankings.map(r => r.rank));
    const filteredRankings = rankings.filter(r => r.rank < lowestRank);
    
    const userCount = filteredRankings.length;

    console.log("DATE: ", date)
    console.log("userCount", userCount)
    console.log("reactionCount", reactionCount)
    console.log('Proposed gem distribution:');
    
    const gemDistribution = filteredRankings.map(ranking => {
      const gems = calculateGems(ranking.rank, userCount, reactionCount);
      console.log(`${ranking.username} (Rank ${ranking.rank}): ${gems} gems`);
      return { ...ranking, gems };
    });

    const confirmation = await getUserInput('Do you want to proceed with updating the gem balances? (yes/no): ');

    if (confirmation.toLowerCase() === 'yes') {
      for (const user of gemDistribution) {
        const newBalance = await incrementUserGemsAndNotify(user.userId, user.gems, user.rank);
        console.log(`Updated gem balance for ${user.username} (Rank ${user.rank}): ${newBalance}`);
        console.log(`Notifications sent for ${user.username}`);
      }
      console.log('Gem balances have been updated and notifications sent.');
    } else {
      console.log('Operation cancelled. No changes were made to the database.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main();

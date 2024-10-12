import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv'
import * as readline from 'readline';

dotenv.config()

// Set up Apollo Client
const client = new ApolloClient({
  link: createHttpLink({
    uri: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL, // Use your absolute Hasura GraphQL endpoint here
    fetch,
    headers: {
      'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET, // Replace with your Hasura admin secret
    },
  }),
  cache: new InMemoryCache(),
});

// GraphQL query to get user rankings for a specific date
const GET_USER_RANKINGS = gql`
  query GetUserRankings($date: date!) {
    daily_user_scores_with_history(where: {date: {_eq: $date}}, order_by: {rank: asc}) {
      user_id
      date
      score
      rank
      user {
        username
      }
    }
  }
`;

// Add this new GraphQL query
const GET_QUESTION_COUNT = gql`
  query GetQuestionCount($date: date!) {
    questions_aggregate(where: {date: {_eq: $date}}) {
      aggregate {
        count
      }
    }
  }
`;

// Function to get user rankings for a specific date
async function getUserRankings(date: string) {
  try {
    const { data } = await client.query({
      query: GET_USER_RANKINGS,
      variables: { date },
    });

    return data.daily_user_scores_with_history.map(entry => ({
      userId: entry.user_id,
      username: entry.user.username,
      date: entry.date,
      score: entry.score,
      rank: entry.rank,
    }));
  } catch (error) {
    console.error('Error fetching user rankings:', error);
    throw error;
  }
}

// Add this new function to get the question count
async function getQuestionCount(date: string): Promise<number> {
  try {
    const { data } = await client.query({
      query: GET_QUESTION_COUNT,
      variables: { date },
    });
    return data.questions_aggregate.aggregate.count;
  } catch (error) {
    console.error('Error fetching question count:', error);
    throw error;
  }
}

// Updated function to calculate gold distribution
function calculateGold(rank: number, userCount: number, questionCount: number): number {
    const percentOfUsers = (rank / userCount) * 100

//   if( rank == 1) {
//       return questionCount * 100
//   } else if (rank == 2) {
//     return questionCount * 80
//   } else if (rank == 3) {
//     return questionCount * 70
//   } else if (rank == 4) {
//     return questionCount * 60
//   } else if (rank == 5) {
//     return questionCount * 55
//   } else 
    if(percentOfUsers < 1) {
    return questionCount * 45
  } else if (percentOfUsers < 10) {
    return questionCount * 15
  }else if (percentOfUsers < 25) {
    return questionCount * 4
  } else if (percentOfUsers < 50) {
    return questionCount
  } else {
    return 0
  }
}

// Add this new GraphQL mutation
const INCREMENT_USER_GOLD = gql`
  mutation IncrementUserGold($userId: bigint!, $goldIncrement: Int!) {
    update_users_by_pk(
      pk_columns: {id: $userId}, 
      _inc: {gold_bars: $goldIncrement}
    ) {
      id
      gold_bars
    }
  }
`;

// Add this new GraphQL mutation for inserting a notification
const INSERT_NOTIFICATION = gql`
  mutation InsertNotification($userId: bigint!, $type: String!, $goldAmount: Int, $rank: Int, $competition_name: String) {
    insert_notifications_one(object: {
      for: $userId,
      type: $type,
      gold_amount: $goldAmount,
      rank: $rank,
      competition_name: $competition_name
    }) {
      id
    }
  }
`;

// Update the incrementUserGold function to handle both gold and rank notifications
async function incrementUserGoldAndNotify(userId: string, goldIncrement: number, rank: number) {
  try {
    const promises = [
      client.mutate({
        mutation: INSERT_NOTIFICATION,
        variables: { userId, type: "rank", rank: rank, competition_name: "points" },
      })
    ];

    if (goldIncrement > 0) {
      promises.push(
        client.mutate({
          mutation: INCREMENT_USER_GOLD,
          variables: { userId, goldIncrement },
        }),
        client.mutate({
          mutation: INSERT_NOTIFICATION,
          variables: { userId, type: "prize", goldAmount: goldIncrement },
        })
      );
    }

    const results = await Promise.all(promises);
    return goldIncrement > 0 ? results[1].data.update_users_by_pk.gold_bars : null;
  } catch (error) {
    console.error(`Error incrementing gold and sending notifications for user ${userId}:`, error);
    throw error;
  }
}

// Add this function to get user input
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

// Update the main function
async function main() {
  try {
    const date = '2024-10-11'
    const [rankings, questionCount] = await Promise.all([
      getUserRankings(date),
      getQuestionCount(date)
    ]);
    
    // Remove users with the lowest rank
    const lowestRank = Math.max(...rankings.map(r => r.rank));
    const filteredRankings = rankings.filter(r => r.rank < lowestRank);
    
    const userCount = filteredRankings.length;

    // Calculate gold for each user and print the proposed distribution
    console.log("DATE: ", date)
    console.log("userCount", userCount)
    console.log("questionCount", questionCount)
    console.log('Proposed gold distribution:');
    
    const goldDistribution = filteredRankings.map(ranking => {
      const gold = calculateGold(ranking.rank, userCount, questionCount);
      console.log(`${ranking.username} (Rank ${ranking.rank}): ${gold} gold`);
      return { ...ranking, gold };
    });

    // Ask for user confirmation
    const confirmation = await getUserInput('Do you want to proceed with updating the gold balances? (yes/no): ');

    if (confirmation.toLowerCase() === 'yes') {
      // Update gold balances in the database and send notifications
      for (const user of goldDistribution) {
        const newBalance = await incrementUserGoldAndNotify(user.userId, user.gold, user.rank);
        console.log(`Updated gold balance for ${user.username} (Rank ${user.rank}): ${newBalance}`);
        console.log(`Notifications sent for ${user.username}`);
      }
      console.log('Gold balances have been updated and notifications sent.');
    } else {
      console.log('Operation cancelled. No changes were made to the database.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main();

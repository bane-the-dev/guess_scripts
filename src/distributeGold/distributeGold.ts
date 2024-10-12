import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

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

// GraphQL query to get user details by username
const GET_USER_BY_USERNAME = gql`
  query GetUserByUsername($username: String!) {
    users(where: {username: {_eq: $username}}) {
      id
      username
      gold_bars
    }
  }
`;

// GraphQL mutation to increment user's gold bars
const INCREMENT_USER_GOLD = gql`
  mutation IncrementUserGold($userId: bigint!, $goldIncrement: Int!) {
    update_users_by_pk(
      pk_columns: {id: $userId}, 
      _inc: {gold_bars: $goldIncrement}
    ) {
      id
      gold_bars
      username
    }
  }
`;

// GraphQL mutation to insert a notification
const INSERT_NOTIFICATION = gql`
  mutation InsertNotification($userId: bigint!, $type: String!, $goldAmount: Int!) {
    insert_notifications_one(object: {
      for: $userId,
      type: $type,
      gold_amount: $goldAmount
    }) {
      id
    }
  }
`;

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

// Function to get user details by username
async function getUserByUsername(username: string) {
  try {
    const result = await client.query({
      query: GET_USER_BY_USERNAME,
      variables: { username },
    });

    const users = result.data.users;
    if (users.length === 0) {
      throw new Error(`No user found with username: ${username}`);
    }
    return users[0];
  } catch (error) {
    console.error(`Error fetching user details for username ${username}:`, error);
    throw error;
  }
}

// Function to give gold bars to a user and send a notification
async function giveGoldBarsToUser(userId: string, goldAmount: number) {
  try {
    const [goldResult, notificationResult] = await Promise.all([
      client.mutate({
        mutation: INCREMENT_USER_GOLD,
        variables: { userId: userId, goldIncrement: goldAmount },
      }),
      client.mutate({
        mutation: INSERT_NOTIFICATION,
        variables: { userId: userId, type: 'prize', goldAmount },
      }),
    ]);

    const updatedUser = goldResult.data.update_users_by_pk;
    console.log(`Gold bars added to user ${updatedUser.username}: +${goldAmount} (Total: ${updatedUser.gold_bars})`);
    console.log(`Notification sent for user ${userId}: ${notificationResult.data.insert_notifications_one.id}`);
  } catch (error) {
    console.error(`Error giving gold bars and sending notification to user ${userId}:`, error);
  }
}

// Main function
async function main() {
  try {
    const username = await getUserInput('Enter the username: ');
    const user = await getUserByUsername(username);
    
    console.log(`User found: ${user.username} (ID: ${user.id})`);
    console.log(`Current gold bars: ${user.gold_bars}`);
    
    const proceed = await getUserInput('Do you want to proceed with giving gold bars to this user? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('Operation cancelled.');
      return;
    }

    const goldAmount = parseInt(await getUserInput('Enter the amount of gold bars to give: '), 10);

    if (isNaN(goldAmount)) {
      console.error('Invalid gold amount. Please enter a number.');
      return;
    }

    await giveGoldBarsToUser(user.id, goldAmount);
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Run the script
main();

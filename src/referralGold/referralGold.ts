// import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
// import { createHttpLink } from 'apollo-link-http';
// import fetch from 'cross-fetch';
// import * as dotenv from 'dotenv'
// dotenv.config({ path: '../.env' })

// // Set up Apollo Client
// const client = new ApolloClient({
//   link: createHttpLink({
//     uri: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL, // Use your absolute Hasura GraphQL endpoint here
//     fetch,
//     headers: {
//       'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET, // Replace with your Hasura admin secret
//     },
//   }),
//   cache: new InMemoryCache(),
// });

// // GraphQL query to get all users and their referrals
// const GET_USERS_AND_REFERRALS = gql`
//   query GetUsersAndReferrals {
//     users {
//       id
//       username
//     referred_by
//     }
//   }
// `;

// // Function to get all users and their referral counts
// async function getUsersAndReferrals() {
//   try {
//     const { data } = await client.query({
//       query: GET_USERS_AND_REFERRALS,
//     });

//     const referralCounts = data.users.reduce((counts, user) => {
//       if (user.referred_by) {
//         counts[user.referred_by] = (counts[user.referred_by] || 0) + 1;
//       }
//       return counts;
//     }, {});

//     return data.users.map(user => ({
//       id: user.id,
//       username: user.username,
//       referralCount: referralCounts[user.id] || 0,
//       referred_by: user.referred_by
//     }));
//   } catch (error) {
//     console.error('Error fetching users and referrals:', error);
//     throw error;
//   }
// }

// // Function to sort and print users by referral count
// function printSortedUserReferrals(users) {
//   const sortedUsers = users.sort((a, b) => b.referralCount - a.referralCount);
  
//   console.log("Users sorted by number of referrals:");
//   sortedUsers.forEach((user, index) => {
//     console.log(`${index + 1}. User ID: ${user.id}, Username: ${user.username}, Referrals: ${user.referralCount}`);
//   });
// }

// // Add this new mutation
// const UPDATE_USER_GOLD_BARS = gql`
//   mutation UpdateUserGoldBars($userId: bigint!, $goldBars: Int!) {
//     update_users_by_pk(pk_columns: {id: $userId}, _inc: {gold_bars: $goldBars}) {
//       id
//       username
//       gold_bars
//     }
//   }
// `;

// // New function to update gold bars
// async function updateUserGoldBars(userId: string, referralCount: number) {
//   const goldBarsToAdd = referralCount * 10;
//   try {
//     const { data } = await client.mutate({
//       mutation: UPDATE_USER_GOLD_BARS,
//       variables: { userId, goldBars: goldBarsToAdd }
//     });
//     return data.update_users_by_pk;
//   } catch (error) {
//     console.error(`Error updating gold bars for user ${userId}:`, error);
//     throw error;
//   }
// }

// // Add this new mutation for referred users
// const UPDATE_REFERRED_USER_GOLD_BARS = gql`
//   mutation UpdateReferredUserGoldBars($userId: bigint!, $goldBars: Int!) {
//     update_users_by_pk(pk_columns: {id: $userId}, _inc: {gold_bars: $goldBars}) {
//       id
//       username
//       gold_bars
//     }
//   }
// `;

// // New function to update gold bars for referred users
// async function updateReferredUserGoldBars(userId: string) {
//   const goldBarsToAdd = 10;
//   try {
//     const { data } = await client.mutate({
//       mutation: UPDATE_REFERRED_USER_GOLD_BARS,
//       variables: { userId, goldBars: goldBarsToAdd }
//     });
//     return data.update_users_by_pk;
//   } catch (error) {
//     console.error(`Error updating gold bars for referred user ${userId}:`, error);
//     throw error;
//   }
// }

// // Modified main function
// async function main() {
//   try {
//     const users = await getUsersAndReferrals();
//     // printSortedUserReferrals(users);

//     // console.log("\nUpdating gold bars for users based on referrals...");
//     // for (const user of users) {
//     //   if (user.referralCount > 0) {
//     //     const updatedUser = await updateUserGoldBars(user.id, user.referralCount);
//     //     console.log(`Updated ${updatedUser.username}: +${user.referralCount * 10} gold bars (Total: ${updatedUser.gold_bars})`);
//     //   }
//     // }

//     console.log("\nUpdating gold bars for referred users...");
//     console.log(users)
//     const referredUsers = users.filter(user => user.referred_by);
//     for (const user of referredUsers) {
//       const updatedUser = await updateReferredUserGoldBars(user.id);
//       console.log(`Updated referred user ${updatedUser.username}: +10 gold bars (Total: ${updatedUser.gold_bars})`);
//     }
//   } catch (error) {
//     console.error('Error:', error);
//   }
// }

// // Run the script
// main();

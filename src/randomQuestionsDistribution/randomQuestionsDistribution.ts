import crypto from 'crypto'
import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv'

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

// GraphQL query to get 150 user IDs
const GET_USER_IDS = gql`
  query GetUserIds {
    users(limit: 150) {
      id
    }
  }
`;

// Function to get all user IDs from the database
async function getAllUserIds(): Promise<string[]> {
  try {
    const { data } = await client.query({ query: GET_USER_IDS });
    return data.users.map(user => user.id.toString());
  } catch (error) {
    console.error('Error fetching user IDs:', error);
    throw error;
  }
}

// Function to generate a deterministic random seed from userId and date
function generateSeed(userId: string, date: string): number {
  const hash = crypto.createHash('sha256').update(userId + date).digest('hex')
  return parseInt(hash.slice(0, 8), 16)
}

// Fisher-Yates shuffle algorithm using the generated seed for deterministic randomness
function shuffleArray<T>(array: T[], seed: number): T[] {
  let random = seed
  const seededRandom = () => {
    random = (random * 9301 + 49297) % 233280
    return random / 233280
  }

  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }

  return newArray
}

// Function to get 10 selected questions for a user
function getSelectedQuestions(userId: string, questions: number[], date: string): number[] {
  const seed = generateSeed(userId, date)
  const shuffledQuestions = shuffleArray(questions, seed)
  return shuffledQuestions.slice(0, Math.min(10, shuffledQuestions.length))
}

// Updated computeQuestionDistribution function
async function computeQuestionDistribution(userIds: string[], questions: number[], date: string) {
  const questionDistribution: Record<number, number> = {};

  questions.forEach(questionId => {
    questionDistribution[questionId] = 0;
  });

  userIds.forEach(userId => {
    const selectedQuestions = getSelectedQuestions(userId, questions, date);
    selectedQuestions.forEach(questionId => {
      questionDistribution[questionId]++;
    });
  });

  return questionDistribution;
}

// Example usage
async function main() {
  const questions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]; // Example list of questions
  const date = '2024-10-11'; // Example date (or use today's date)
  const userIds = await getAllUserIds();

    const questionDistribution = await computeQuestionDistribution(userIds, questions, date);
    console.log('Question distribution:', questionDistribution);
}

// Run the script
main();

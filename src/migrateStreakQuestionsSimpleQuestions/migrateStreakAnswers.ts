import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from '@apollo/client/link/http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

// Function to create a new Apollo Client
function createClient() {
  return new ApolloClient({
    link: createHttpLink({
      uri: process.env.HASURA_GRAPHQL_URL,
      fetch,
      headers: {
        'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
      },
    }),
    cache: new InMemoryCache(),
  });
}

let client = createClient();

const GET_STREAK_ANSWERS = gql`
  query GetStreakAnswers {
    streak_user_answers {
      id
      user_id
      streak_question_id
      answer
      streak_question {
        picture_1
        picture_2
      }
    }
  }
`;

const GET_SIMPLE_QUESTION_ID = gql`
  query GetSimpleQuestionId($picture1: uuid!, $picture2: uuid!) {
    simple_questions(where: {
      _and: [
        { picture_1: { _eq: $picture1 } },
        { picture_2: { _eq: $picture2 } }
      ]
    }) {
      id
    }
  }
`;

const INSERT_SIMPLE_ANSWER = gql`
  mutation InsertSimpleAnswer($userId: bigint!, $questionId: bigint!, $answer: Boolean!) {
    insert_simple_user_answers_one(object: {
      user_id: $userId,
      simple_question_id: $questionId,
      answer: $answer,
      correct_answer: true
    }) {
      id
    }
  }
`;

// Retry wrapper for GraphQL operations
async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      // Recreate client on failure
      client = createClient();

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('All retry attempts failed');
}

async function migrateAnswers() {
  try {
    // Step 1: Get all streak answers with their question details
    const { data: streakAnswersData } = await retryOperation(() =>
      client.query({
        query: GET_STREAK_ANSWERS,
      })
    );

    console.log(`Found ${streakAnswersData.streak_user_answers.length} streak answers to migrate`);

    // Step 2: Process each answer
    let migratedCount = 0;
    let skippedCount = 0;

    for (const streakAnswer of streakAnswersData.streak_user_answers) {
      try {
        if (!streakAnswer.streak_question) {
          console.warn(`Skipping answer ${streakAnswer.id} - no associated question found`);
          skippedCount++;
          continue;
        }

        // Get corresponding simple question ID
        const { data: simpleQuestionData } = await retryOperation(() =>
          client.query({
            query: GET_SIMPLE_QUESTION_ID,
            variables: {
              picture1: streakAnswer.streak_question.picture_1,
              picture2: streakAnswer.streak_question.picture_2,
            },
          })
        );

        if (!simpleQuestionData.simple_questions.length) {
          console.warn(
            `No matching simple question found for streak answer ${streakAnswer.id}`,
            `(pictures: ${streakAnswer.streak_question.picture_1}, ${streakAnswer.streak_question.picture_2})`
          );
          skippedCount++;
          continue;
        }

        const simpleQuestionId = simpleQuestionData.simple_questions[0].id;

        // Insert the answer into simple_user_answers
        await retryOperation(() =>
          client.mutate({
            mutation: INSERT_SIMPLE_ANSWER,
            variables: {
              userId: streakAnswer.user_id,
              questionId: simpleQuestionId,
              answer: streakAnswer.answer,
            },
          })
        );

        migratedCount++;
        if (migratedCount % 100 === 0) {
          console.log(`Progress: ${migratedCount} answers migrated`);
        }

      } catch (error) {
        console.error(`Failed to migrate answer ${streakAnswer.id}:`, error);
        skippedCount++;
      }
    }

    console.log('\nMigration Summary:');
    console.log(`Successfully migrated: ${migratedCount} answers`);
    console.log(`Skipped: ${skippedCount} answers`);
    console.log('Migration completed!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateAnswers().then(() => process.exit(0));
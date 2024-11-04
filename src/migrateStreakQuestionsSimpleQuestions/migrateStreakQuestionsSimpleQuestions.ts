import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

// Function to create a new Apollo Client
function createApolloClient() {
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

// Set up Apollo Client
let client = createApolloClient();

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
      client = createApolloClient();

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('All retry attempts failed');
}

const GET_STREAK_QUESTIONS = gql`
  query GetStreakQuestions {
    streak_questions {
      id
      picture_1
      picture_2
      category
      is_active
    }
  }
`;

const INSERT_SIMPLE_QUESTION = gql`
  mutation InsertSimpleQuestion($picture1: uuid!, $picture2: uuid!, $category: String!, $isActive: Boolean!) {
    insert_simple_questions_one(object: {
      picture_1: $picture1,
      picture_2: $picture2,
      category: $category,
      is_active: $isActive,
    }) {
      id
    }
  }
`;

const GET_STREAK_ANSWERS = gql`
  query GetStreakAnswers {
    streak_user_answers {
      id
      user_id
      streak_question_id
      answer
    }
  }
`;

const INSERT_SIMPLE_ANSWERS = gql`
  mutation InsertSimpleAnswers($objects: [simple_user_answers_insert_input!]!) {
    insert_simple_user_answers(objects: $objects) {
      affected_rows
    }
  }
`;

async function migrateData() {
  try {
    console.log('Starting migration process...');

    // Step 1: Get all streak questions
    console.log('Fetching streak questions...');
    const { data: streakQuestionsData } = await retryOperation(() =>
      client.query({
        query: GET_STREAK_QUESTIONS,
      })
    );
    console.log(`Found ${streakQuestionsData.streak_questions.length} streak questions to migrate`);

    // Step 2: Create mapping between old and new question IDs
    const questionIdMapping = new Map();

    // Step 3: Insert each streak question into simple_questions
    console.log('Starting question migration...');
    for (const [index, streakQuestion] of streakQuestionsData.streak_questions.entries()) {
      console.log(`Migrating question ${index + 1}/${streakQuestionsData.streak_questions.length}...`);

      const simpleQuestionData = await retryOperation(() =>
        client.mutate({
          mutation: INSERT_SIMPLE_QUESTION,
          variables: {
            picture1: streakQuestion.picture_1,
            picture2: streakQuestion.picture_2,
            category: streakQuestion.category,
            isActive: streakQuestion.is_active,
          },
        })
      );

      questionIdMapping.set(
        streakQuestion.id,
        simpleQuestionData.data.insert_simple_questions_one.id
      );
    }

    console.log(`Successfully migrated ${questionIdMapping.size} questions`);

    // Step 4: Get all streak answers
    console.log('Fetching streak answers...');
    const { data: streakAnswersData } = await retryOperation(() =>
      client.query({
        query: GET_STREAK_ANSWERS,
      })
    );
    console.log(`Found ${streakAnswersData.streak_user_answers.length} answers to migrate`);

    // Step 5: Insert streak answers into simple_answers with mapped question IDs
    let migratedAnswersCount = 0;
    let skippedAnswersCount = 0;
    const CHUNK_SIZE = 100;
    let answerChunk: any[] = [];

    console.log('Starting answer migration...');
    for (const [index, streakAnswer] of streakAnswersData.streak_user_answers.entries()) {
      const newQuestionId = questionIdMapping.get(streakAnswer.streak_question_id);

      if (!newQuestionId) {
        console.warn(`Skipping answer - No mapping found for streak question ID: ${streakAnswer.streak_question_id}`);
        skippedAnswersCount++;
        continue;
      }

      answerChunk.push({
        user_id: streakAnswer.user_id,
        simple_question_id: newQuestionId,
        answer: streakAnswer.answer,
        correct_answer: true
      });

      // When chunk is full or we're at the last item, insert the chunk
      if (answerChunk.length === CHUNK_SIZE || index === streakAnswersData.streak_user_answers.length - 1) {
        if (answerChunk.length > 0) {
          await retryOperation(() =>
            client.mutate({
              mutation: INSERT_SIMPLE_ANSWERS,
              variables: {
                objects: answerChunk
              },
            })
          );

          migratedAnswersCount += answerChunk.length;
          console.log(`Progress: ${index + 1}/${streakAnswersData.streak_user_answers.length} answers processed`);
          answerChunk = []; // Reset the chunk
        }
      }
    }

    console.log('\nMigration Summary:');
    console.log(`- Questions migrated: ${questionIdMapping.size}`);
    console.log(`- Answers migrated: ${migratedAnswersCount}`);
    console.log(`- Answers skipped: ${skippedAnswersCount}`);
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateData().then(() => process.exit(0));